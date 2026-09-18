import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { useFeatures } from './FeatureContext';
import {
  fetchUserChurches,
  fetchChurchFeatures,
  createChurch,
  updateChurchProfile,
  requestJoinChurch,
  updateChurchFeatureOverride,
  removeMember,
  getEffectiveChurchFeatureState
} from '../services/churchService';

const ChurchContext = createContext({
  myChurches: [],
  activeChurches: [],
  activeChurchesCount: 0,
  churchNavLabel: 'Join a Church',
  activeChurch: null,
  activeChurchId: null,
  activeRole: null,
  isPastor: false,
  isWorshipLeader: false,
  isMember: false,
  churchOverrides: {},
  loading: false,
  error: null,
  selectChurch: () => {},
  refreshChurches: async () => {},
  isChurchFeatureActive: () => false,
  registerChurch: async () => ({ success: false }),
  joinChurch: async () => ({ success: false }),
  updateProfile: async () => ({ success: false }),
  toggleChurchFeature: async () => ({ success: false }),
  leaveCurrentChurch: async () => ({ success: false })
});

const ACTIVE_CHURCH_STORAGE_KEY = 'acs_active_church_id';

export function ChurchProvider({ children }) {
  const { user, profile } = useAuth();
  const isAdmin = Boolean(user && profile?.role === 'admin');
  const { availability } = useFeatures();

  const [rawChurches, setRawChurches] = useState([]);
  const [activeChurchId, setActiveChurchId] = useState(() => {
    return localStorage.getItem(ACTIVE_CHURCH_STORAGE_KEY) || null;
  });
  const [churchOverrides, setChurchOverrides] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Active churches: user has an active membership AND the church is active
  const activeChurches = useMemo(() => {
    return (rawChurches || []).filter(c => {
      const isMembershipActive = c.membershipStatus === 'active' || (c.status === 'active' && !c.membershipStatus);
      const isChurchActive = c.churchStatus ? c.churchStatus === 'active' : (c.status === 'active');
      return isMembershipActive && isChurchActive;
    });
  }, [rawChurches]);

  const activeChurchesCount = activeChurches.length;

  const churchNavLabel = useMemo(() => {
    if (activeChurchesCount === 0) return 'Join a Church';
    if (activeChurchesCount === 1) return 'My Church';
    return 'My Churches';
  }, [activeChurchesCount]);

  // Load churches for the authenticated user
  const loadChurches = useCallback(async () => {
    if (!user?.id) {
      setRawChurches([]);
      setActiveChurchId(null);
      setChurchOverrides({});
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetchUserChurches(user.id);
      if (res.success) {
        const list = res.data || [];
        setRawChurches(list);

        // Filter for active churches to establish active selection
        const activeList = list.filter(c => {
          const isMembershipActive = c.membershipStatus === 'active' || (c.status === 'active' && !c.membershipStatus);
          const isChurchActive = c.churchStatus ? c.churchStatus === 'active' : (c.status === 'active');
          return isMembershipActive && isChurchActive;
        });

        if (activeList.length > 0) {
          const storedId = localStorage.getItem(ACTIVE_CHURCH_STORAGE_KEY);
          const found = activeList.find(c => c.id === storedId);
          if (found) {
            setActiveChurchId(found.id);
          } else {
            setActiveChurchId(activeList[0].id);
            localStorage.setItem(ACTIVE_CHURCH_STORAGE_KEY, activeList[0].id);
          }
        } else {
          setActiveChurchId(null);
          localStorage.removeItem(ACTIVE_CHURCH_STORAGE_KEY);
        }
      } else {
        setError(res.error || 'Failed to load churches.');
      }
    } catch (err) {
      setError(err.message || 'Unexpected error loading churches.');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadChurches();
  }, [loadChurches]);

  // Derive active church object (restricted to active memberships in active churches)
  const activeChurch = useMemo(() => {
    if (!activeChurchId || !activeChurches.length) return null;
    return activeChurches.find(c => c.id === activeChurchId) || null;
  }, [activeChurchId, activeChurches]);

  // Derive active role
  const activeRole = useMemo(() => {
    if (!activeChurch) return null;
    return activeChurch.role || 'member';
  }, [activeChurch]);

  const isPastor = Boolean(isAdmin || activeRole === 'pastor');
  const isWorshipLeader = Boolean(activeRole === 'worship_leader');
  const isMember = Boolean(activeChurch && (activeChurch.membershipStatus === 'active' || activeChurch.status === 'active'));

  // Load feature overrides whenever activeChurchId changes
  useEffect(() => {
    let isMounted = true;

    async function loadOverrides() {
      if (!activeChurchId) {
        setChurchOverrides({});
        return;
      }

      const res = await fetchChurchFeatures(activeChurchId);
      if (isMounted && res.success) {
        setChurchOverrides(res.data || {});
      }
    }

    loadOverrides();

    return () => {
      isMounted = false;
    };
  }, [activeChurchId]);

  // Select an active church
  const selectChurch = useCallback((churchId) => {
    setActiveChurchId(churchId);
    if (churchId) {
      localStorage.setItem(ACTIVE_CHURCH_STORAGE_KEY, churchId);
    } else {
      localStorage.removeItem(ACTIVE_CHURCH_STORAGE_KEY);
    }
  }, []);

  // Centralized Two-Tier Feature Resolution Hook
  const isChurchFeatureActive = useCallback((featureId) => {
    if (!activeChurchId) return false;
    return getEffectiveChurchFeatureState(
      activeChurchId,
      featureId,
      availability,
      churchOverrides
    );
  }, [activeChurchId, availability, churchOverrides]);

  // Register a new Church Workspace
  const registerChurch = useCallback(async (churchInput) => {
    const res = await createChurch(churchInput);
    if (res.success) {
      await loadChurches();
      if (res.data?.id) {
        selectChurch(res.data.id);
      }
    }
    return res;
  }, [loadChurches, selectChurch]);

  // Request to join a Church Workspace
  const joinChurch = useCallback(async (churchId) => {
    if (!user?.id) return { success: false, error: 'Must be signed in to join a church.' };
    const res = await requestJoinChurch(churchId, user.id);
    if (res.success) {
      await loadChurches();
    }
    return res;
  }, [user?.id, loadChurches]);

  // Update Church Profile
  const updateProfile = useCallback(async (churchId, profileData) => {
    const res = await updateChurchProfile(churchId, profileData);
    if (res.success) {
      await loadChurches();
    }
    return res;
  }, [loadChurches]);

  // Toggle church feature override
  const toggleChurchFeature = useCallback(async (featureId, isEnabled) => {
    if (!activeChurchId) return { success: false, error: 'No active church selected.' };
    const res = await updateChurchFeatureOverride(activeChurchId, featureId, isEnabled);
    if (res.success) {
      setChurchOverrides(prev => ({ ...prev, [featureId]: isEnabled }));
    }
    return res;
  }, [activeChurchId]);

  // Leave current church
  const leaveCurrentChurch = useCallback(async () => {
    if (!activeChurch?.membershipId) return { success: false, error: 'No active membership.' };
    const res = await removeMember(activeChurch.membershipId);
    if (res.success) {
      await loadChurches();
    }
    return res;
  }, [activeChurch, loadChurches]);

  const value = useMemo(() => ({
    myChurches: activeChurches,
    activeChurches,
    activeChurchesCount,
    churchNavLabel,
    allChurches: rawChurches,
    pendingMemberships: (rawChurches || []).filter(c => c.membershipStatus === 'pending'),
    activeChurch,
    activeChurchId,
    activeRole,
    isPastor,
    isWorshipLeader,
    isMember,
    churchOverrides,
    loading,
    error,
    selectChurch,
    refreshChurches: loadChurches,
    isChurchFeatureActive,
    registerChurch,
    joinChurch,
    updateProfile,
    toggleChurchFeature,
    leaveCurrentChurch
  }), [
    activeChurches,
    activeChurchesCount,
    churchNavLabel,
    rawChurches,
    activeChurch,
    activeChurchId,
    activeRole,
    isPastor,
    isWorshipLeader,
    isMember,
    churchOverrides,
    loading,
    error,
    selectChurch,
    loadChurches,
    isChurchFeatureActive,
    registerChurch,
    joinChurch,
    updateProfile,
    toggleChurchFeature,
    leaveCurrentChurch
  ]);

  return (
    <ChurchContext.Provider value={value}>
      {children}
    </ChurchContext.Provider>
  );
}

export function useChurch() {
  const context = useContext(ChurchContext);
  if (!context) {
    throw new Error('useChurch must be used within a ChurchProvider');
  }
  return context;
}
