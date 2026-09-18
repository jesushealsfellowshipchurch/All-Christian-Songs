import React, { useState } from 'react';
import {
  Sliders,
  Lock,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Loader2,
  Search,
  ShieldAlert,
  Info
} from 'lucide-react';
import { useFeatures } from '../../context/FeatureContext';

export default function AdminFeatureControl() {
  const {
    adminFeatures,
    toggleFeature,
    loading,
    error: contextError,
    refreshFeatures,
    isFallback
  } = useFeatures();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [togglingId, setTogglingId] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null); // { feature, targetState }
  const [statusMessage, setStatusMessage] = useState(null); // { type: 'success'|'error', text }

  // Filter features
  const filteredFeatures = (adminFeatures || []).filter(feature => {
    if (selectedCategory !== 'all' && feature.category !== selectedCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = feature.display_name?.toLowerCase().includes(q);
      const matchDesc = feature.description?.toLowerCase().includes(q);
      const matchId = feature.id?.toLowerCase().includes(q);
      if (!matchName && !matchDesc && !matchId) return false;
    }
    return true;
  });

  // Handler when clicking toggle switch
  const handleToggleClick = (feature) => {
    if (feature.is_system) {
      setStatusMessage({
        type: 'error',
        text: `"${feature.display_name}" is a protected core system feature and cannot be disabled.`
      });
      return;
    }

    const nextState = !feature.is_enabled;

    // If disabling a live user-facing feature, show safe confirmation modal
    if (!nextState && (feature.category === 'worship' || feature.category === 'core')) {
      setConfirmModal({
        feature,
        targetState: nextState
      });
      return;
    }

    // Direct toggle
    executeToggle(feature.id, nextState, feature.display_name);
  };

  // Perform optimistic toggle with rollback
  const executeToggle = async (featureId, nextState, featureName) => {
    setTogglingId(featureId);
    setStatusMessage(null);

    const result = await toggleFeature(featureId, nextState);

    if (result.success) {
      setStatusMessage({
        type: 'success',
        text: `"${featureName}" is now ${nextState ? 'ENABLED (Visible to users)' : 'DISABLED (Hidden from users)'}.`
      });
    } else {
      setStatusMessage({
        type: 'error',
        text: result.error || 'Failed to update feature toggle. Rolled back.'
      });
    }

    setTogglingId(null);
  };

  return (
    <div className="space-y-6 animate-fadeIn">

      {/* Top Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/20 border border-slate-800/80 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-80 h-full bg-amber-500/5 blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0">
              <Sliders className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-xl font-bold text-white tracking-tight">Feature Control & Availability</h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  Super Admin
                </span>
                {isFallback && (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                    Static Seed Baseline
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-slate-400 max-w-2xl leading-relaxed">
                Control runtime feature availability for all visitors and congregation members.
                System features (<Lock className="w-3 h-3 inline text-amber-400 -mt-0.5" />) are enforced at the database level and cannot be turned off.
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              setStatusMessage(null);
              refreshFeatures();
            }}
            disabled={loading}
            className="self-start md:self-auto px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold border border-slate-700 transition flex items-center gap-2"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Status Feedback Toast */}
      {statusMessage && (
        <div
          className={`
            p-4 rounded-xl text-xs sm:text-sm flex items-center justify-between border animate-fadeIn
            ${statusMessage.type === 'success'
              ? 'bg-emerald-950/30 text-emerald-300 border-emerald-500/40'
              : 'bg-rose-950/30 text-rose-300 border-rose-500/40'
            }
          `}
        >
          <div className="flex items-center gap-2">
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button
            onClick={() => setStatusMessage(null)}
            className="text-slate-400 hover:text-white ml-4 font-bold"
          >
            ×
          </button>
        </div>
      )}

      {/* Filter / Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between p-3.5 bg-slate-900/60 border border-slate-800 rounded-xl">
        
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search features or descriptions..."
            className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
          />
        </div>

        {/* Category Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {[
            { id: 'all', label: 'All Categories' },
            { id: 'core', label: 'Core' },
            { id: 'worship', label: 'Worship' },
            { id: 'church', label: 'Church' },
            { id: 'platform', label: 'Platform' }
          ].map(c => (
            <button
              key={c.id}
              onClick={() => setSelectedCategory(c.id)}
              className={`
                px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition
                ${selectedCategory === c.id
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60 border border-transparent'
                }
              `}
            >
              {c.label}
            </button>
          ))}
        </div>

      </div>

      {/* Features Table / List */}
      <div className="bg-slate-900/60 border border-slate-800/90 rounded-2xl overflow-hidden">
        <div className="divide-y divide-slate-800/80">
          {filteredFeatures.map((feat) => {
            const isToggling = togglingId === feat.id;
            const isSystem = Boolean(feat.is_system);
            const isEnabled = Boolean(feat.is_enabled);

            return (
              <div
                key={feat.id}
                className={`
                  p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition
                  ${isEnabled ? 'bg-slate-950/40 hover:bg-slate-950/60' : 'bg-slate-950/80 hover:bg-slate-950'}
                `}
              >
                {/* Feature Info */}
                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-bold text-white tracking-tight">
                      {feat.display_name}
                    </h3>

                    {/* Category Pill */}
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 border border-slate-700">
                      {feat.category}
                    </span>

                    {/* Phase Pill */}
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-800/60 text-slate-400 border border-slate-700/60">
                      {feat.phase}
                    </span>

                    {/* Status Pill */}
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-800/60 text-slate-400 border border-slate-700/60 capitalize">
                      {feat.status}
                    </span>

                    {/* System Feature Protection Badge */}
                    {isSystem && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                        <Lock className="w-3 h-3 text-amber-400" />
                        Locked System Feature
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-400 leading-relaxed max-w-3xl">
                    {feat.description}
                  </p>

                  <div className="text-[11px] text-slate-500 font-mono">
                    ID: {feat.id}
                  </div>
                </div>

                {/* Control Switch / Locked Indicator */}
                <div className="flex items-center gap-3 shrink-0 self-start md:self-center">
                  
                  {isSystem ? (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-400 text-xs select-none">
                      <Lock className="w-3.5 h-3.5 text-amber-400" />
                      <span className="font-semibold text-slate-300">Always Enabled</span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={isToggling}
                      onClick={() => handleToggleClick(feat)}
                      className={`
                        relative inline-flex h-7 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-amber-400/50 disabled:opacity-50
                        ${isEnabled ? 'bg-emerald-500' : 'bg-slate-800'}
                      `}
                      aria-pressed={isEnabled}
                      title={isEnabled ? 'Click to disable' : 'Click to enable'}
                    >
                      <span className="sr-only">Toggle {feat.display_name}</span>
                      <span
                        className={`
                          pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out flex items-center justify-center
                          ${isEnabled ? 'translate-x-7' : 'translate-x-0'}
                        `}
                      >
                        {isToggling ? (
                          <Loader2 className="w-3 h-3 text-slate-600 animate-spin" />
                        ) : isEnabled ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                        )}
                      </span>
                    </button>
                  )}

                  <span
                    className={`
                      text-xs font-bold w-12 text-left
                      ${isEnabled ? 'text-emerald-400' : 'text-slate-500'}
                    `}
                  >
                    {isEnabled ? 'ON' : 'OFF'}
                  </span>

                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Safety Confirmation Modal for Disabling User-Facing Features */}
      {confirmModal && (
        <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Disable Feature?</h3>
                <p className="text-xs text-slate-400">Confirmation required</p>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Are you sure you want to disable <strong className="text-white font-semibold">{confirmModal.feature.display_name}</strong>?
            </p>

            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-400 space-y-1">
              <p className="font-semibold text-amber-400 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> Immediate Impact:
              </p>
              <p>• Navigation links and buttons for this feature will be hidden from all users immediately.</p>
              <p>• User data remains safely stored and will not be deleted.</p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const feat = confirmModal.feature;
                  const targetState = confirmModal.targetState;
                  setConfirmModal(null);
                  executeToggle(feat.id, targetState, feat.display_name);
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white transition shadow-sm"
              >
                Yes, Disable Feature
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
