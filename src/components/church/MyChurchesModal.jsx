import React, { useState } from 'react';
import {
  X,
  Church,
  Plus,
  Link as LinkIcon,
  Search,
  MapPin,
  Check,
  AlertCircle,
  Loader2,
  ChevronRight,
  ShieldCheck,
  ArrowRight
} from 'lucide-react';
import { useChurch } from '../../context/ChurchContext';
import { useAuth } from '../../context/AuthContext';
import { lookupChurchForJoin, fetchPublicDirectory } from '../../services/churchService';

export default function MyChurchesModal({
  isOpen,
  onClose,
  onOpenWorkspace,
  initialTab = 'list'
}) {
  const { user } = useAuth();
  const {
    activeChurches,
    myChurches,
    activeChurchId,
    selectChurch,
    joinChurch,
    refreshChurches
  } = useChurch();

  const churchList = activeChurches && activeChurches.length >= 0 ? activeChurches : (myChurches || []);

  const [activeView, setActiveView] = useState(initialTab || 'list'); // 'list' | 'join' | 'directory'
  const [submitting, setSubmitting] = useState(false);
  const [feedbackError, setFeedbackError] = useState('');
  const [feedbackSuccess, setFeedbackSuccess] = useState('');

  // Join by Link/Slug State
  const [slugInput, setSlugInput] = useState('');
  const [targetChurch, setTargetChurch] = useState(null);
  const [lookingUp, setLookingUp] = useState(false);

  // Directory Search State
  const [directoryQuery, setDirectoryQuery] = useState('');
  const [directoryResults, setDirectoryResults] = useState([]);
  const [loadingDirectory, setLoadingDirectory] = useState(false);

  // Reset or initialize tab on modal open or tab change
  React.useEffect(() => {
    if (isOpen) {
      const defaultTab = initialTab || (churchList.length === 0 ? 'join' : 'list');
      setActiveView(defaultTab);
      setFeedbackError('');
      setFeedbackSuccess('');
      if (defaultTab === 'directory') {
        fetchPublicDirectory().then(res => res.success && setDirectoryResults(res.data || []));
      }
    }
  }, [isOpen, initialTab, churchList.length]);

  if (!isOpen) return null;

  // Handle opening workspace for a specific church
  const handleSelectAndOpen = (churchId) => {
    selectChurch(churchId);
    if (onOpenWorkspace) {
      onOpenWorkspace();
    }
  };

  // Look up church by slug
  const handleLookupSlug = async (e) => {
    e.preventDefault();
    if (!slugInput.trim()) return;

    setLookingUp(true);
    setFeedbackError('');
    setFeedbackSuccess('');
    setTargetChurch(null);

    // Clean input if user pasted full URL
    const cleanSlug = slugInput.trim().replace(/^.*\/church\//, '').toLowerCase();

    const res = await lookupChurchForJoin(cleanSlug);
    if (res.success && res.data) {
      setTargetChurch(res.data);
    } else {
      setFeedbackError(res.error || 'No active church workspace found with this slug.');
    }
    setLookingUp(false);
  };

  // Submit join request
  const handleJoinRequest = async (churchId) => {
    setSubmitting(true);
    setFeedbackError('');
    setFeedbackSuccess('');

    const res = await joinChurch(churchId);
    if (res.success) {
      setFeedbackSuccess('Join request submitted! The church pastor will review your request.');
      setTargetChurch(null);
      setSlugInput('');
      await refreshChurches();
      setTimeout(() => {
        setActiveView('list');
      }, 1400);
    } else {
      setFeedbackError(res.error || 'Failed to submit join request.');
    }
    setSubmitting(false);
  };

  // Search Public Directory
  const handleSearchDirectory = async (e) => {
    e.preventDefault();
    setLoadingDirectory(true);
    setFeedbackError('');

    const res = await fetchPublicDirectory(directoryQuery);
    if (res.success) {
      setDirectoryResults(res.data || []);
    } else {
      setFeedbackError(res.error || 'Failed to search directory.');
    }
    setLoadingDirectory(false);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-slate-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <Church className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white">
                {activeView === 'list' ? 'My Church Workspaces' : 'Join a Church'}
              </h2>
              <p className="text-xs text-slate-400">
                {activeView === 'list' ? 'Manage your congregation fellowships & memberships' : 'Find and connect with your congregation fellowship'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* View Switcher Sub-nav */}
        <div className="flex border-b border-slate-800 px-4 sm:px-6 bg-slate-900/50 gap-2 overflow-x-auto">
          <button
            onClick={() => { setActiveView('list'); setFeedbackError(''); setFeedbackSuccess(''); }}
            className={`py-3 px-3 text-xs sm:text-sm font-semibold border-b-2 transition ${
              activeView === 'list'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            My Churches ({churchList.length})
          </button>
          <button
            onClick={() => { setActiveView('join'); setFeedbackError(''); setFeedbackSuccess(''); }}
            className={`py-3 px-3 text-xs sm:text-sm font-semibold border-b-2 transition flex items-center gap-1.5 ${
              activeView === 'join'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <LinkIcon className="w-3.5 h-3.5" />
            <span>Join by Link</span>
          </button>
          <button
            onClick={() => {
              setActiveView('directory');
              setFeedbackError('');
              setFeedbackSuccess('');
              fetchPublicDirectory().then(res => res.success && setDirectoryResults(res.data || []));
            }}
            className={`py-3 px-3 text-xs sm:text-sm font-semibold border-b-2 transition flex items-center gap-1.5 ${
              activeView === 'directory'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>Directory</span>
          </button>
        </div>

        {/* Feedback Alerts */}
        {feedbackSuccess && (
          <div className="mx-6 mt-4 p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs rounded-xl flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0" />
            <span>{feedbackSuccess}</span>
          </div>
        )}
        {feedbackError && (
          <div className="mx-6 mt-4 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{feedbackError}</span>
          </div>
        )}

        {/* Body Content */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
          
          {/* VIEW 1: MY CHURCHES LIST */}
          {activeView === 'list' && (
            <div className="space-y-3">
              {churchList.length === 0 ? (
                <div className="p-8 text-center rounded-2xl bg-slate-800/30 border border-slate-800 space-y-3">
                  <Church className="w-10 h-10 text-slate-500 mx-auto" />
                  <h3 className="text-sm font-bold text-white">No Church Memberships Yet</h3>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    You can join your local Christian congregation via a direct fellowship link or search our public directory of verified churches.
                  </p>
                  <div className="flex justify-center gap-3 pt-2">
                    <button
                      onClick={() => setActiveView('join')}
                      className="px-4 py-2 rounded-xl text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 transition flex items-center gap-1.5 shadow-sm"
                    >
                      <LinkIcon className="w-3.5 h-3.5" />
                      <span>Join via Link</span>
                    </button>
                    <button
                      onClick={() => {
                        setActiveView('directory');
                        fetchPublicDirectory().then(res => res.success && setDirectoryResults(res.data || []));
                      }}
                      className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition flex items-center gap-1.5"
                    >
                      <Search className="w-3.5 h-3.5" />
                      <span>Browse Directory</span>
                    </button>
                  </div>
                </div>
              ) : (
                churchList.map(c => {
                  const isCurrent = c.id === activeChurchId;
                  const isPending = c.status === 'pending';
                  return (
                    <div
                      key={c.id}
                      className={`p-4 rounded-2xl border transition flex items-center justify-between gap-4 ${
                        isCurrent
                          ? 'bg-amber-500/5 border-amber-500/30'
                          : 'bg-slate-800/40 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm sm:text-base font-bold text-white truncate">{c.name}</h4>
                          {c.verification_status === 'verified' && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30">
                              <ShieldCheck className="w-2.5 h-2.5" /> Verified
                            </span>
                          )}
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                            c.status === 'active'
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                              : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                          }`}>
                            {c.status === 'active' ? 'Active' : 'Pending Approval'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                          {c.city && <span>{c.city}</span>}
                          <span>•</span>
                          <span className="capitalize font-medium text-amber-300">
                            Role: {c.role || 'Member'}
                          </span>
                        </p>
                      </div>

                      <div className="shrink-0 flex items-center gap-2">
                        {isPending ? (
                          <span className="text-xs text-amber-400/90 italic">Awaiting Pastor</span>
                        ) : (
                          <button
                            onClick={() => handleSelectAndOpen(c.id)}
                            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                              isCurrent
                                ? 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                                : 'bg-slate-800 text-white hover:bg-slate-700 border border-slate-700'
                            }`}
                          >
                            <span>Open</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* VIEW 2: JOIN BY SLUG / DIRECT LINK */}
          {activeView === 'join' && (
            <div className="space-y-4">
              <form onSubmit={handleLookupSlug} className="space-y-3">
                <label className="block text-xs font-semibold text-slate-300">
                  Enter Church Slug or Fellowship Link
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    value={slugInput}
                    onChange={(e) => setSlugInput(e.target.value)}
                    placeholder="e.g. grace-fellowship-hyderabad"
                    className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-sm text-white focus:ring-2 focus:ring-amber-400/50 outline-none"
                  />
                  <button
                    type="submit"
                    disabled={lookingUp}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition flex items-center gap-1.5 shrink-0"
                  >
                    {lookingUp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    <span>Lookup</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-500">
                  Pastors can provide their direct church link to fellowship members (e.g. allchristiansongs.org/church/grace-fellowship).
                </p>
              </form>

              {/* Target Church Preview Confirmation Card */}
              {targetChurch && (
                <div className="p-4 rounded-2xl bg-slate-800/50 border border-amber-500/30 space-y-3 animate-fadeIn">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                      <Church className="w-5 h-5 text-amber-400" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">{targetChurch.name}</h4>
                      {targetChurch.city && <p className="text-xs text-slate-400">{targetChurch.city}</p>}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800 flex justify-end">
                    <button
                      onClick={() => handleJoinRequest(targetChurch.church_id)}
                      disabled={submitting}
                      className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition flex items-center gap-1.5"
                    >
                      {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      <span>Submit Membership Request</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* VIEW 3: PUBLIC DIRECTORY */}
          {activeView === 'directory' && (
            <div className="space-y-4">
              <form onSubmit={handleSearchDirectory} className="flex gap-2">
                <input
                  type="text"
                  value={directoryQuery}
                  onChange={(e) => setDirectoryQuery(e.target.value)}
                  placeholder="Search verified churches by name or city..."
                  className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-sm text-white focus:ring-2 focus:ring-amber-400/50 outline-none"
                />
                <button
                  type="submit"
                  disabled={loadingDirectory}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 transition flex items-center gap-1.5"
                >
                  {loadingDirectory ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  <span>Search</span>
                </button>
              </form>

              <div className="space-y-2">
                {loadingDirectory ? (
                  <div className="p-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Searching directory...
                  </div>
                ) : directoryResults.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400 bg-slate-800/20 rounded-2xl border border-slate-800">
                    No verified public congregations found matching your search.
                  </div>
                ) : (
                  directoryResults.map(c => (
                    <div key={c.id} className="p-3.5 rounded-2xl bg-slate-800/40 border border-slate-800 flex items-center justify-between gap-4">
                      <div>
                        <h5 className="text-sm font-bold text-white flex items-center gap-1.5">
                          <span>{c.name}</span>
                          <ShieldCheck className="w-3 h-3 text-sky-400" />
                        </h5>
                        <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3" /> {c.city || c.country}
                        </p>
                      </div>
                      <button
                        onClick={() => handleJoinRequest(c.id)}
                        disabled={submitting}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 transition"
                      >
                        Request Join
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
