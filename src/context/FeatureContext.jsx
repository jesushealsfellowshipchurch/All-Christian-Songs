import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from './AuthContext';
import {
  DEFAULT_FEATURES,
  DEFAULT_AVAILABILITY,
  fetchPublicFeatureAvailability,
  fetchAdminFeatureCatalog,
  updateFeatureToggle,
  calculateFactualCounts
} from '../services/featureService';

const FeatureContext = createContext({
  isFeatureEnabled: () => true,
  availability: DEFAULT_AVAILABILITY,
  adminFeatures: DEFAULT_FEATURES,
  factualCounts: calculateFactualCounts(DEFAULT_FEATURES),
  loading: false,
  error: null,
  isFallback: true,
  toggleFeature: async () => ({ success: false }),
  refreshFeatures: async () => {}
});

export function FeatureProvider({ children }) {
  const { user, profile } = useAuth();
  const isAdmin = Boolean(user && profile?.role === 'admin');

  const [availability, setAvailability] = useState(DEFAULT_AVAILABILITY);
  const [adminFeatures, setAdminFeatures] = useState(DEFAULT_FEATURES);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isFallback, setIsFallback] = useState(true);

  // Load appropriate feature set based on auth state
  const loadFeatures = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      if (isAdmin) {
        // Super Admin gets full Product Journey & Feature Control catalog
        const res = await fetchAdminFeatureCatalog();
        if (res.success && res.data) {
          setAdminFeatures(res.data);
          const map = { ...DEFAULT_AVAILABILITY };
          for (const f of res.data) {
            map[f.id] = Boolean(f.is_enabled);
          }
          setAvailability(map);
          setIsFallback(res.isFallback);
        }
      } else {
        // Public/Regular user gets ONLY minimal runtime availability
        const res = await fetchPublicFeatureAvailability();
        if (res.success && res.data) {
          setAvailability(res.data);
          setIsFallback(res.isFallback);
        }
      }
    } catch (err) {
      console.warn('[FeatureContext] Error loading features, using static defaults:', err);
      setError(err.message);
      setAvailability(DEFAULT_AVAILABILITY);
      setAdminFeatures(DEFAULT_FEATURES);
      setIsFallback(true);
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    loadFeatures();
  }, [loadFeatures]);

  /**
   * Check if a feature is enabled at runtime.
   * System features are always enforced enabled.
   */
  const isFeatureEnabled = useCallback((featureId) => {
    // System features cannot be disabled
    const defaultFeat = DEFAULT_FEATURES.find(f => f.id === featureId);
    if (defaultFeat?.is_system) {
      return true;
    }

    if (Object.prototype.hasOwnProperty.call(availability, featureId)) {
      return Boolean(availability[featureId]);
    }
    return Boolean(DEFAULT_AVAILABILITY[featureId] ?? false);
  }, [availability]);

  /**
   * Optimistic toggle with automatic rollback on failure (Super Admin only).
   */
  const toggleFeature = useCallback(async (featureId, nextEnabled) => {
    if (!isAdmin) {
      return { success: false, error: 'Unauthorized: Admin access required.' };
    }

    // Protection for system features
    const targetFeat = (adminFeatures || DEFAULT_FEATURES).find(f => f.id === featureId);
    if (targetFeat?.is_system && !nextEnabled) {
      return {
        success: false,
        error: 'System features are vital to platform operation and cannot be disabled.'
      };
    }

    // Save previous snapshot for rollback
    const prevAvailability = { ...availability };
    const prevAdminFeatures = [...adminFeatures];

    // Optimistically update local state
    setAvailability(prev => ({
      ...prev,
      [featureId]: Boolean(nextEnabled)
    }));
    setAdminFeatures(prev =>
      prev.map(f => f.id === featureId ? { ...f, is_enabled: Boolean(nextEnabled) } : f)
    );

    // Perform database update
    const result = await updateFeatureToggle(featureId, nextEnabled, adminFeatures);

    if (!result.success) {
      // Rollback on failure
      setAvailability(prevAvailability);
      setAdminFeatures(prevAdminFeatures);
      setError(result.error);
      return { success: false, error: result.error };
    }

    return { success: true, data: result.data };
  }, [isAdmin, availability, adminFeatures]);

  // Simple factual counts (Total, Completed, Active, Ready, Planned, Deferred)
  const factualCounts = useMemo(() => {
    return calculateFactualCounts(adminFeatures || DEFAULT_FEATURES);
  }, [adminFeatures]);

  const value = useMemo(() => ({
    isFeatureEnabled,
    availability,
    adminFeatures,
    factualCounts,
    loading,
    error,
    isFallback,
    toggleFeature,
    refreshFeatures: loadFeatures
  }), [
    isFeatureEnabled,
    availability,
    adminFeatures,
    factualCounts,
    loading,
    error,
    isFallback,
    toggleFeature,
    loadFeatures
  ]);

  return (
    <FeatureContext.Provider value={value}>
      {children}
    </FeatureContext.Provider>
  );
}

export function useFeatures() {
  const context = useContext(FeatureContext);
  if (!context) {
    throw new Error('useFeatures must be used within a FeatureProvider');
  }
  return context;
}
