import React, { useState, useMemo } from 'react';
import {
  Compass,
  CheckCircle2,
  PlayCircle,
  Clock,
  Calendar,
  AlertCircle,
  Search,
  Filter,
  Lock,
  Sparkles,
  Layers,
  ChevronDown,
  ChevronRight,
  Info
} from 'lucide-react';
import { useFeatures } from '../../context/FeatureContext';

// Ordered Phase sequence for grouping
const PHASE_ORDER = [
  { id: 'Foundation', title: 'Foundation & Core Engine', subtitle: 'Core song catalog, indexing, Supabase auth, and platform admin' },
  { id: 'Phase 0', title: 'Phase 0: Service Essentials', subtitle: 'Worship gathering essentials & landing page featured songs' },
  { id: 'Phase 1', title: 'Phase 1: Personal Cloud', subtitle: 'Authenticated cross-device personal cloud favorites' },
  { id: 'Phase 2A', title: 'Phase 2A: Platform Control & Projection', subtitle: 'Super Admin roadmap oversight, feature availability, & projector mode' },
  { id: 'Phase 2B', title: 'Phase 2B: Church Workspaces & Musician Tools', subtitle: 'Congregation profiles and dynamic musical chord transposition' },
  { id: 'Phase 3', title: 'Phase 3: Liturgy, Offline & Teams', subtitle: 'Service order setlists, rural offline PWA, and pastor/leader roles' },
  { id: 'Future', title: 'Future: Ministry Scaling & SaaS', subtitle: 'Multi-campus congregation management & subscription services' }
];

export default function AdminProductJourney() {
  const { adminFeatures, factualCounts, loading, isFallback } = useFeatures();

  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedPhases, setExpandedPhases] = useState(() =>
    PHASE_ORDER.reduce((acc, p) => ({ ...acc, [p.id]: true }), {})
  );

  const togglePhase = (phaseId) => {
    setExpandedPhases(prev => ({
      ...prev,
      [phaseId]: !prev[phaseId]
    }));
  };

  // Filter features based on status, category, and search text
  const filteredFeatures = useMemo(() => {
    return adminFeatures.filter(feature => {
      if (statusFilter !== 'all' && feature.status !== statusFilter) return false;
      if (categoryFilter !== 'all' && feature.category !== categoryFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = feature.display_name?.toLowerCase().includes(q);
        const matchDesc = feature.description?.toLowerCase().includes(q);
        const matchId = feature.id?.toLowerCase().includes(q);
        if (!matchTitle && !matchDesc && !matchId) return false;
      }
      return true;
    });
  }, [adminFeatures, statusFilter, categoryFilter, searchQuery]);

  // Group filtered features by phase
  const featuresByPhase = useMemo(() => {
    const grouped = {};
    for (const phase of PHASE_ORDER) {
      grouped[phase.id] = [];
    }
    for (const feat of filteredFeatures) {
      const p = feat.phase || 'Foundation';
      if (!grouped[p]) grouped[p] = [];
      grouped[p].push(feat);
    }
    return grouped;
  }, [filteredFeatures]);

  return (
    <div className="space-y-6 animate-fadeIn">

      {/* Top Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/20 border border-slate-800/80 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-80 h-full bg-amber-500/5 blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0">
              <Compass className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-xl font-bold text-white tracking-tight">Product Journey & Roadmap</h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  Super Admin Only
                </span>
                {isFallback && (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                    Static Seed Baseline
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-slate-400 max-w-2xl leading-relaxed">
                Authoritative architectural roadmap and development status. Tracks what is completed,
                what is active, what is ready, and what is planned for future milestones.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Factual Status Counts (No Misleading Percentage Calculations) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        
        {/* Total */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-slate-400">Total Features</span>
            <Layers className="w-4 h-4 text-slate-500" />
          </div>
          <div className="text-2xl font-black text-white">{factualCounts.total}</div>
          <p className="text-[10px] text-slate-500 mt-0.5">Approved scope</p>
        </div>

        {/* Completed */}
        <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/30 hover:border-emerald-500/50 transition">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-emerald-400">Completed</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-300">{factualCounts.completed}</div>
          <p className="text-[10px] text-emerald-400/70 mt-0.5">Built & verified</p>
        </div>

        {/* Active */}
        <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-500/30 hover:border-amber-500/50 transition">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-amber-400">Active</span>
            <PlayCircle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-300">{factualCounts.active}</div>
          <p className="text-[10px] text-amber-400/70 mt-0.5">Live in production</p>
        </div>

        {/* Ready */}
        <div className="p-4 rounded-xl bg-indigo-950/20 border border-indigo-500/30 hover:border-indigo-500/50 transition">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-indigo-400">Ready</span>
            <Sparkles className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-black text-indigo-300">{factualCounts.ready}</div>
          <p className="text-[10px] text-indigo-400/70 mt-0.5">Staged for rollout</p>
        </div>

        {/* Planned */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-slate-400">Planned</span>
            <Clock className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-black text-slate-300">{factualCounts.planned}</div>
          <p className="text-[10px] text-slate-500 mt-0.5">Roadmap milestones</p>
        </div>

        {/* Deferred */}
        <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 hover:border-slate-700 transition">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-slate-500">Deferred</span>
            <Calendar className="w-4 h-4 text-slate-600" />
          </div>
          <div className="text-2xl font-black text-slate-500">{factualCounts.deferred}</div>
          <p className="text-[10px] text-slate-600 mt-0.5">Postponed review</p>
        </div>

      </div>

      {/* Controls Bar: Search & Status Filters */}
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

        {/* Status Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {[
            { id: 'all', label: `All (${factualCounts.total})` },
            { id: 'completed', label: `Completed (${factualCounts.completed})` },
            { id: 'active', label: `Active (${factualCounts.active})` },
            { id: 'ready', label: `Ready (${factualCounts.ready})` },
            { id: 'planned', label: `Planned (${factualCounts.planned})` }
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setStatusFilter(f.id)}
              className={`
                px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition
                ${statusFilter === f.id
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60 border border-transparent'
                }
              `}
            >
              {f.label}
            </button>
          ))}
        </div>

      </div>

      {/* Roadmap Phase Timeline / Sections */}
      <div className="space-y-4">
        {PHASE_ORDER.map(phase => {
          const phaseFeatures = featuresByPhase[phase.id] || [];
          if (phaseFeatures.length === 0 && (statusFilter !== 'all' || searchQuery.trim())) {
            return null;
          }

          const isExpanded = Boolean(expandedPhases[phase.id]);

          return (
            <div
              key={phase.id}
              className="bg-slate-900/60 border border-slate-800/90 rounded-2xl overflow-hidden transition-all duration-200"
            >
              {/* Phase Header */}
              <button
                onClick={() => togglePhase(phase.id)}
                className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-slate-800/40 transition"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400">
                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm sm:text-base font-bold text-white tracking-wide">{phase.title}</h2>
                      <span className="text-xs px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-semibold border border-slate-700">
                        {phaseFeatures.length} {phaseFeatures.length === 1 ? 'feature' : 'features'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5 hidden sm:block">{phase.subtitle}</p>
                  </div>
                </div>
              </button>

              {/* Phase Features List */}
              {isExpanded && (
                <div className="p-4 pt-1 space-y-2.5 border-t border-slate-800/50">
                  {phaseFeatures.length === 0 ? (
                    <div className="py-6 text-center text-xs text-slate-500">
                      No features in this phase match current filter criteria.
                    </div>
                  ) : (
                    phaseFeatures.map(feat => {
                      const isCompleted = feat.status === 'completed';
                      const isActive = feat.status === 'active';
                      const isReady = feat.status === 'ready';
                      const isPlanned = feat.status === 'planned';

                      return (
                        <div
                          key={feat.id}
                          className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 hover:border-slate-700 transition flex flex-col md:flex-row md:items-center justify-between gap-3"
                        >
                          <div className="space-y-1 min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-sm font-semibold text-white tracking-tight">
                                {feat.display_name}
                              </h3>

                              {/* Category Badge */}
                              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 border border-slate-700">
                                {feat.category}
                              </span>

                              {/* System Feature Protection Badge */}
                              {feat.is_system && (
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                                  <Lock className="w-3 h-3 text-amber-400" />
                                  Core System
                                </span>
                              )}
                            </div>

                            <p className="text-xs text-slate-400 leading-relaxed max-w-3xl">
                              {feat.description}
                            </p>
                          </div>

                          {/* Distinct Status & Runtime State Pills */}
                          <div className="flex items-center gap-2 shrink-0 self-start md:self-center">
                            
                            {/* Product Journey Status Badge */}
                            <span
                              className={`
                                text-xs font-semibold px-3 py-1 rounded-full flex items-center gap-1.5 border
                                ${isCompleted
                                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                  : isActive
                                  ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                                  : isReady
                                  ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
                                  : 'bg-slate-800 text-slate-400 border-slate-700'
                                }
                              `}
                            >
                              {isCompleted && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                              {isActive && <PlayCircle className="w-3.5 h-3.5 text-amber-400" />}
                              {isReady && <Sparkles className="w-3.5 h-3.5 text-indigo-400" />}
                              {isPlanned && <Clock className="w-3.5 h-3.5 text-slate-400" />}
                              <span className="capitalize">{feat.status}</span>
                            </span>

                            {/* Live Runtime Availability State (Distinct from Status) */}
                            <span
                              className={`
                                text-[11px] font-bold px-2.5 py-1 rounded-md border
                                ${feat.is_enabled
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                  : 'bg-slate-800/80 text-slate-500 border-slate-700'
                                }
                              `}
                            >
                              {feat.is_enabled ? 'LIVE ON' : 'STANDBY OFF'}
                            </span>

                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

    </div>
  );
}
