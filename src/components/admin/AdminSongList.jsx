import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search,
  Filter,
  ArrowUpDown,
  RefreshCw,
  AlertCircle,
  FileText,
  Video,
  Music,
  BookOpen,
  CheckCircle2,
  Clock,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Loader2,
  X,
  Eye,
  Edit3,
  MoreVertical,
  HelpCircle,
  SlidersHorizontal,
  Plus,
  Trash2,
  EyeOff,
  AlertTriangle
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  getAdminCatalog,
  unpublishSong,
  deleteSong,
  checkSongDeleteEligibility
} from '../../services/adminSongService';
import AdminCreateSong from './AdminCreateSong';
import AdminEditSong from './AdminEditSong';

const STANDARD_CATEGORIES = [
  'Worship Songs',
  'Praise Songs',
  'Prayer Songs',
  'Hope Songs',
  'Christmas Songs',
  'Easter Songs',
  'Gospel Songs',
  'Encouraging Songs',
  'Comfort Songs',
  'Sunday School Songs',
  'Thanksgiving Songs',
  'Repentance Songs',
  'Commitment Songs',
  'Second Coming Songs',
  'Good Friday Songs',
  'Marriage Songs',
  'Offering Songs',
  'Correction Songs'
];

/**
 * Format ISO timestamp into human-readable date.
 */
function formatDate(isoString) {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch (_) {
    return '—';
  }
}

/**
 * AdminSongList Component
 * 
 * Provides administrative hymnal catalog review and filtering.
 * Connects directly to adminSongService.getAdminCatalog() under PostgreSQL RLS.
 * 
 * NOTE: UI role checks (profile?.role === 'admin') serve strictly as a UX gate.
 * The database Row Level Security policies remain the authoritative boundary.
 */
export default function AdminSongList({ onSelectSong, onCreateSong, onEditSong }) {
  const { session, user, profile, loading: authLoading } = useAuth();

  // View Mode Toggles
  const [isCreating, setIsCreating] = useState(false);
  const [editingSongId, setEditingSongId] = useState(null);

  // Query & Filter States
  const [searchInput, setSearchInput] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all'); // 'all' | 'published' | 'draft'
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('updated_at');
  const [sortAsc, setSortAsc] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Data States
  const [songs, setSongs] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);
  const [feedbackNotice, setFeedbackNotice] = useState(null);

  // Debounce search input to avoid network requests on keystrokes
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchInput.trim());
      setCurrentPage(1); // Reset page on new search
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Reset page when filters change
  const handleFilterChange = (setter, value) => {
    setter(value);
    setCurrentPage(1);
  };

  // Fetch catalog records from admin service
  const fetchCatalog = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const options = {
        query: debouncedQuery,
        language: selectedLanguage,
        status: selectedStatus,
        category: selectedCategory === 'all' ? null : selectedCategory,
        sortBy,
        sortAsc,
        page: currentPage,
        pageSize
      };

      const result = await getAdminCatalog(options);

      if (result.error) {
        setErrorMessage(result.error);
        setSongs([]);
        setTotalCount(0);
      } else {
        setSongs(result.songs || []);
        setTotalCount(result.totalCount || 0);
      }
    } catch (err) {
      setErrorMessage('Unable to load admin catalog. Please check your connection and try again.');
      setSongs([]);
      setTotalCount(0);
    } finally {
      setIsLoading(false);
    }
  }, [debouncedQuery, selectedLanguage, selectedStatus, selectedCategory, sortBy, sortAsc, currentPage, pageSize]);

  // Trigger catalog fetch when query/filters/pagination change
  useEffect(() => {
    // Only fetch if session is authenticated or once auth check finishes
    if (!authLoading) {
      fetchCatalog();
    }
  }, [authLoading, fetchCatalog]);

  // Unpublish Modal State
  const [unpublishTarget, setUnpublishTarget] = useState(null);
  const [isUnpublishing, setIsUnpublishing] = useState(false);
  const [unpublishError, setUnpublishError] = useState(null);

  // Delete Modal State
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteEligibility, setDeleteEligibility] = useState({
    isLoading: false,
    canDelete: false,
    isPinned: false,
    songbookCount: 0,
    song: null,
    blockReason: null,
    error: null
  });
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  // Unpublish Handlers
  const handleOpenUnpublish = (song) => {
    setUnpublishTarget(song);
    setUnpublishError(null);
  };

  const handleCloseUnpublish = () => {
    if (isUnpublishing) return;
    setUnpublishTarget(null);
    setUnpublishError(null);
  };

  const handleConfirmUnpublish = async () => {
    if (!unpublishTarget) return;
    setIsUnpublishing(true);
    setUnpublishError(null);

    const res = await unpublishSong(unpublishTarget.id);
    setIsUnpublishing(false);

    if (!res.success) {
      setUnpublishError(res.error || 'Failed to unpublish hymn.');
      return;
    }

    setFeedbackNotice(`Song "${unpublishTarget.title}" was unpublished and moved to Draft.`);
    setUnpublishTarget(null);
    fetchCatalog();
    setTimeout(() => setFeedbackNotice(null), 5000);
  };

  // Delete Handlers
  const handleOpenDelete = async (song) => {
    setDeleteTarget(song);
    setDeleteConfirmInput('');
    setDeleteError(null);
    setDeleteEligibility({
      isLoading: true,
      canDelete: false,
      isPinned: false,
      songbookCount: 0,
      song: null,
      blockReason: null,
      error: null
    });

    const res = await checkSongDeleteEligibility(song.id, song.slug);
    setDeleteEligibility({
      isLoading: false,
      canDelete: res.canDelete,
      isPinned: res.isPinned,
      songbookCount: res.songbookCount,
      song: res.song || song,
      blockReason: res.blockReason,
      error: res.error
    });
  };

  const handleCloseDelete = () => {
    if (isDeleting) return;
    setDeleteTarget(null);
    setDeleteConfirmInput('');
    setDeleteError(null);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget || deleteConfirmInput !== 'DELETE' || !deleteEligibility.canDelete) return;
    setIsDeleting(true);
    setDeleteError(null);

    const res = await deleteSong(deleteTarget.id);
    setIsDeleting(false);

    if (!res.success) {
      setDeleteError(res.error || 'Failed to delete hymn record.');
      return;
    }

    setFeedbackNotice(`Song "${deleteTarget.title}" has been permanently deleted.`);
    setDeleteTarget(null);
    fetchCatalog();
    setTimeout(() => setFeedbackNotice(null), 5000);
  };

  // Action placeholder feedback for upcoming phases (e.g. Phase 9B-6 Songbook Management)
  const handleActionPlaceholder = (actionName, songTitle) => {
    setFeedbackNotice(`${actionName} action for "${songTitle}" will be available in the upcoming phase.`);
    setTimeout(() => setFeedbackNotice(null), 4000);
  };

  // Pagination metrics
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const rangeStart = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const rangeEnd = Math.min(totalCount, currentPage * pageSize);

  // 1. Auth Loading Gate
  if (authLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-slate-300">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin mb-4" />
        <p className="text-sm font-medium">Verifying administrator credentials...</p>
      </div>
    );
  }

  // 2. Unauthenticated Gate
  if (!session || !user) {
    return (
      <div className="max-w-2xl mx-auto my-12 p-8 bg-slate-900/90 border border-slate-800 rounded-3xl text-center shadow-xl backdrop-blur-md">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-100 mb-2">Administrator Access Required</h2>
        <p className="text-sm text-slate-400 mb-6 leading-relaxed">
          The Hymnal Administration Console requires an authenticated administrator session.
          Please sign in with your ministry credentials to manage hymn catalog records.
        </p>
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-xs text-slate-300">
          <span>Security Notice: All write operations are protected by PostgreSQL Row Level Security.</span>
        </div>
      </div>
    );
  }

  // 3. Unauthorized Profile Gate
  if (profile && profile.role !== 'admin') {
    return (
      <div className="max-w-2xl mx-auto my-12 p-8 bg-slate-900/90 border border-rose-500/30 rounded-3xl text-center shadow-xl backdrop-blur-md">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-100 mb-2">Permission Denied</h2>
        <p className="text-sm text-slate-400 mb-4 leading-relaxed">
          Your account (<span className="text-slate-200 font-medium">{user.email}</span>) is authenticated,
          but does not possess administrative privileges in the church profile registry.
        </p>
        <p className="text-xs text-slate-500">
          Contact the church systems administrator if you believe this is an error.
        </p>
      </div>
    );
  }

  // Active Creation Mode View
  if (isCreating) {
    return (
      <AdminCreateSong
        onBackToList={() => setIsCreating(false)}
        onSuccess={(createdSong) => {
          setIsCreating(false);
          fetchCatalog();
          setFeedbackNotice(`Hymn "${createdSong.title}" created successfully in the database.`);
        }}
      />
    );
  }

  // Active Edit Mode View
  if (editingSongId) {
    return (
      <AdminEditSong
        songId={editingSongId}
        onBackToList={() => setEditingSongId(null)}
        onSuccess={(updatedSong) => {
          setEditingSongId(null);
          fetchCatalog();
          setFeedbackNotice(`Hymn "${updatedSong.title}" updated successfully in the database.`);
        }}
      />
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6 text-slate-100">
      {/* Top Header & Overview */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-100">
              Hymnal Administration
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
              Admin RLS
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Browse, inspect, and filter published and draft hymns directly from the database.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          <button
            onClick={() => {
              if (onCreateSong) {
                onCreateSong();
              } else {
                setIsCreating(true);
              }
            }}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-md shadow-amber-500/10 transition-all cursor-pointer"
            title="Create a new hymn"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Song</span>
          </button>

          <button
            onClick={fetchCatalog}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800/90 hover:bg-slate-800 text-slate-200 border border-slate-700 hover:border-slate-600 transition-all disabled:opacity-50"
            title="Refresh list from database"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-amber-400' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Temporary User Feedback Banner */}
      {feedbackNotice && (
        <div className="flex items-center justify-between p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs sm:text-sm animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <HelpCircle className="w-4 h-4 flex-shrink-0" />
            <span>{feedbackNotice}</span>
          </div>
          <button onClick={() => setFeedbackNotice(null)} className="text-amber-400 hover:text-amber-200 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-4 space-y-3 shadow-md backdrop-blur-sm">
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by Telugu/English title, transliteration, or songwriter..."
            className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-950/70 border border-slate-700/80 focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/50 text-slate-100 text-sm placeholder:text-slate-500 outline-none transition-all"
          />
          {searchInput && (
            <button
              onClick={() => setSearchInput('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-1"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Controls Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2.5 pt-1 text-xs">
          {/* Language Filter */}
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">Language</label>
            <select
              value={selectedLanguage}
              onChange={(e) => handleFilterChange(setSelectedLanguage, e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950/80 border border-slate-800 text-slate-200 outline-none focus:border-amber-500/50"
            >
              <option value="all">All Languages</option>
              <option value="telugu">Telugu (తెలుగు)</option>
              <option value="english">English</option>
              <option value="hindi">Hindi (हिन्दी)</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => handleFilterChange(setSelectedStatus, e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950/80 border border-slate-800 text-slate-200 outline-none focus:border-amber-500/50"
            >
              <option value="all">All Statuses</option>
              <option value="published">Published Only</option>
              <option value="draft">Drafts Only</option>
            </select>
          </div>

          {/* Category Filter */}
          <div className="col-span-2 sm:col-span-2 lg:col-span-2">
            <label className="block text-[11px] font-medium text-slate-400 mb-1">Category</label>
            <select
              value={selectedCategory}
              onChange={(e) => handleFilterChange(setSelectedCategory, e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950/80 border border-slate-800 text-slate-200 outline-none focus:border-amber-500/50"
            >
              <option value="all">All Categories</option>
              {STANDARD_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Sort By Field */}
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">Sort By</label>
            <select
              value={sortBy}
              onChange={(e) => handleFilterChange(setSortBy, e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950/80 border border-slate-800 text-slate-200 outline-none focus:border-amber-500/50"
            >
              <option value="updated_at">Last Updated</option>
              <option value="title">Title</option>
              <option value="title_transliterated">Transliterated</option>
              <option value="created_at">Date Created</option>
            </select>
          </div>

          {/* Sort Direction Toggle */}
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">Order</label>
            <button
              onClick={() => {
                setSortAsc(!sortAsc);
                setCurrentPage(1);
              }}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-950/80 border border-slate-800 text-slate-200 hover:border-slate-700 transition-all"
            >
              <span>{sortAsc ? 'Ascending' : 'Descending'}</span>
              <ArrowUpDown className="w-3 h-3 text-amber-400 ml-1" />
            </button>
          </div>
        </div>

        {/* Active Filter Summary Bar */}
        {(selectedLanguage !== 'all' || selectedStatus !== 'all' || selectedCategory !== 'all' || debouncedQuery) && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/60 text-xs">
            <span className="text-slate-400 text-[11px]">Active Filters:</span>
            {debouncedQuery && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-800 text-slate-200 border border-slate-700">
                Query: "{debouncedQuery}"
                <X className="w-3 h-3 cursor-pointer hover:text-rose-400" onClick={() => setSearchInput('')} />
              </span>
            )}
            {selectedLanguage !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-800 text-slate-200 border border-slate-700 capitalize">
                {selectedLanguage}
                <X className="w-3 h-3 cursor-pointer hover:text-rose-400" onClick={() => setSelectedLanguage('all')} />
              </span>
            )}
            {selectedStatus !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-800 text-slate-200 border border-slate-700 capitalize">
                {selectedStatus}
                <X className="w-3 h-3 cursor-pointer hover:text-rose-400" onClick={() => setSelectedStatus('all')} />
              </span>
            )}
            {selectedCategory !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-800 text-slate-200 border border-slate-700">
                {selectedCategory}
                <X className="w-3 h-3 cursor-pointer hover:text-rose-400" onClick={() => setSelectedCategory('all')} />
              </span>
            )}
            <button
              onClick={() => {
                setSearchInput('');
                setSelectedLanguage('all');
                setSelectedStatus('all');
                setSelectedCategory('all');
                setCurrentPage(1);
              }}
              className="text-[11px] text-amber-400 hover:text-amber-300 underline ml-auto cursor-pointer"
            >
              Reset all filters
            </button>
          </div>
        )}
      </div>

      {/* Content Area */}
      {errorMessage ? (
        /* Error State */
        <div className="p-8 rounded-2xl bg-rose-950/20 border border-rose-500/30 text-center space-y-4">
          <div className="w-12 h-12 mx-auto rounded-full bg-rose-500/10 flex items-center justify-center text-rose-400">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-rose-200">Catalog Loading Failed</h3>
            <p className="text-xs sm:text-sm text-rose-300/80 mt-1 max-w-md mx-auto">{errorMessage}</p>
          </div>
          <button
            onClick={fetchCatalog}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow-lg transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry Query</span>
          </button>
        </div>
      ) : isLoading ? (
        /* Loading Skeleton */
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="h-20 rounded-2xl bg-slate-900/60 border border-slate-800/80 animate-pulse flex items-center px-4 justify-between"
            >
              <div className="space-y-2 w-1/3">
                <div className="h-4 bg-slate-800 rounded w-3/4" />
                <div className="h-3 bg-slate-800/60 rounded w-1/2" />
              </div>
              <div className="h-4 bg-slate-800/50 rounded w-24 hidden sm:block" />
              <div className="h-6 bg-slate-800/60 rounded w-16" />
            </div>
          ))}
        </div>
      ) : songs.length === 0 ? (
        /* Empty State */
        <div className="p-12 rounded-2xl bg-slate-900/50 border border-slate-800/80 text-center space-y-3">
          <FileText className="w-12 h-12 text-slate-600 mx-auto" />
          <h3 className="text-base font-semibold text-slate-200">No songs found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            No hymnal records matched your current query or filter criteria. Try adjusting your search keywords or clearing active filters.
          </p>
        </div>
      ) : (
        /* Data Presentation: Table (Desktop) & Cards (Mobile) */
        <div className="space-y-4">
          {/* Desktop/Tablet Table Layout */}
          <div className="hidden md:block overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 shadow-md">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">Song Information</th>
                  <th className="py-3 px-4">Language & Category</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Assets & Media</th>
                  <th className="py-3 px-4">Updated</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {songs.map((song) => {
                  const hasChords = Array.isArray(song.chords) && song.chords.length > 0;
                  const hasYoutube = !!song.youtube_id;
                  const hasPpt = !!song.ppt_url;
                  const hasSongbooks = Array.isArray(song.songbooks) && song.songbooks.length > 0;

                  return (
                    <tr
                      key={song.id}
                      className="hover:bg-slate-850/50 transition-colors group"
                    >
                      {/* Title & Transliteration */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="font-semibold text-slate-100 text-sm truncate group-hover:text-amber-400 transition-colors">
                          {song.title}
                        </div>
                        {song.title_transliterated && (
                          <div className="text-[11px] text-slate-400 truncate italic">
                            {song.title_transliterated}
                          </div>
                        )}
                        {(song.author_english || song.author_telugu) && (
                          <div className="text-[10px] text-slate-500 truncate mt-0.5">
                            By: {song.author_telugu || song.author_english}
                          </div>
                        )}
                      </td>

                      {/* Language & Category */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col gap-1 items-start">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide bg-slate-800 text-slate-300 border border-slate-700">
                            {song.language} ({song.alphabet})
                          </span>
                          {Array.isArray(song.category_names) && song.category_names.length > 0 ? (
                            <span className="text-[11px] text-slate-400 truncate max-w-[140px]" title={song.category_names.join(', ')}>
                              {song.category_names[0]}
                              {song.category_names.length > 1 && ` +${song.category_names.length - 1}`}
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-500">Uncategorized</span>
                          )}
                        </div>
                      </td>

                      {/* Publication Status */}
                      <td className="py-3.5 px-4">
                        {song.is_published ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            <CheckCircle2 className="w-3 h-3" />
                            Published
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-amber-500/15 text-amber-400 border border-amber-500/30">
                            <Clock className="w-3 h-3" />
                            Draft
                          </span>
                        )}
                      </td>

                      {/* Media & Asset Badges */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2 text-slate-400">
                          <span
                            className={`p-1.5 rounded-lg border text-xs ${hasChords ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : 'bg-slate-900 border-slate-800/50 text-slate-600'}`}
                            title={hasChords ? 'Chords available' : 'No chords'}
                          >
                            <Music className="w-3.5 h-3.5" />
                          </span>
                          <span
                            className={`p-1.5 rounded-lg border text-xs ${hasYoutube ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-slate-900 border-slate-800/50 text-slate-600'}`}
                            title={hasYoutube ? 'YouTube video linked' : 'No YouTube video'}
                          >
                            <Video className="w-3.5 h-3.5" />
                          </span>
                          <span
                            className={`p-1.5 rounded-lg border text-xs ${hasPpt ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' : 'bg-slate-900 border-slate-800/50 text-slate-600'}`}
                            title={hasPpt ? 'PowerPoint presentation linked' : 'No PPT presentation'}
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </span>
                          <span
                            className={`p-1.5 rounded-lg border text-xs ${hasSongbooks ? 'bg-purple-500/10 border-purple-500/30 text-purple-400' : 'bg-slate-900 border-slate-800/50 text-slate-600'}`}
                            title={hasSongbooks ? `${song.songbooks.length} hymnal book(s)` : 'No hymnal book assignment'}
                          >
                            <BookOpen className="w-3.5 h-3.5" />
                          </span>
                        </div>
                      </td>

                      {/* Updated At */}
                      <td className="py-3.5 px-4 text-slate-400 text-xs whitespace-nowrap">
                        {formatDate(song.updated_at)}
                      </td>

                      {/* Action Buttons */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5 justify-end">
                          <button
                            onClick={() => {
                              if (onEditSong) {
                                onEditSong(song.id);
                              } else {
                                setEditingSongId(song.id);
                              }
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer"
                            title="Edit hymn"
                            aria-label={`Edit ${song.title}`}
                          >
                            <Edit3 className="w-3 h-3 text-amber-400" />
                            <span>Edit</span>
                          </button>

                          {song.is_published ? (
                            <button
                              onClick={() => handleOpenUnpublish(song)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-amber-950/30 hover:bg-amber-900/50 text-amber-300 border border-amber-600/40 transition-colors cursor-pointer"
                              title="Unpublish hymn (move to draft)"
                              aria-label={`Unpublish ${song.title}`}
                            >
                              <EyeOff className="w-3 h-3 text-amber-400" />
                              <span className="hidden xl:inline">Unpublish</span>
                            </button>
                          ) : null}

                          <button
                            onClick={() => handleOpenDelete(song)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-rose-950/30 hover:bg-rose-900/50 text-rose-300 border border-rose-600/40 transition-colors cursor-pointer"
                            title="Permanently delete hymn record"
                            aria-label={`Delete ${song.title}`}
                          >
                            <Trash2 className="w-3 h-3 text-rose-400" />
                            <span className="hidden xl:inline">Delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card Layout (< md screens) */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {songs.map((song) => {
              const hasChords = Array.isArray(song.chords) && song.chords.length > 0;
              const hasYoutube = !!song.youtube_id;
              const hasPpt = !!song.ppt_url;
              const hasSongbooks = Array.isArray(song.songbooks) && song.songbooks.length > 0;

              return (
                <div
                  key={song.id}
                  className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3 shadow-md"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5 flex-1 min-w-0">
                      <div className="font-semibold text-slate-100 text-sm truncate">
                        {song.title}
                      </div>
                      {song.title_transliterated && (
                        <div className="text-xs text-slate-400 truncate italic">
                          {song.title_transliterated}
                        </div>
                      )}
                      {(song.author_english || song.author_telugu) && (
                        <div className="text-[11px] text-slate-500 truncate">
                          By: {song.author_telugu || song.author_english}
                        </div>
                      )}
                    </div>
                    {song.is_published ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex-shrink-0">
                        <CheckCircle2 className="w-2.5 h-2.5" />
                        Published
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/15 text-amber-400 border border-amber-500/30 flex-shrink-0">
                        <Clock className="w-2.5 h-2.5" />
                        Draft
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400 pt-1 border-t border-slate-800/60">
                    <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-medium uppercase text-[10px]">
                      {song.language} ({song.alphabet})
                    </span>
                    {Array.isArray(song.category_names) && song.category_names[0] && (
                      <span className="px-1.5 py-0.5 rounded bg-slate-800/60 text-slate-400 text-[10px] truncate max-w-[150px]">
                        {song.category_names[0]}
                      </span>
                    )}
                    <span className="text-[10px] text-slate-500 ml-auto">
                      Updated: {formatDate(song.updated_at)}
                    </span>
                  </div>

                  {/* Asset Indicators & Actions Bar */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`p-1 rounded text-xs ${hasChords ? 'bg-amber-500/15 text-amber-400' : 'text-slate-600'}`}
                        title="Chords"
                      >
                        <Music className="w-3.5 h-3.5" />
                      </span>
                      <span
                        className={`p-1 rounded text-xs ${hasYoutube ? 'bg-red-500/15 text-red-400' : 'text-slate-600'}`}
                        title="YouTube"
                      >
                        <Video className="w-3.5 h-3.5" />
                      </span>
                      <span
                        className={`p-1 rounded text-xs ${hasPpt ? 'bg-blue-500/15 text-blue-400' : 'text-slate-600'}`}
                        title="PowerPoint"
                      >
                        <FileText className="w-3.5 h-3.5" />
                      </span>
                      <span
                        className={`p-1 rounded text-xs ${hasSongbooks ? 'bg-purple-500/15 text-purple-400' : 'text-slate-600'}`}
                        title="Songbooks"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap justify-end">
                      <button
                        onClick={() => {
                          if (onEditSong) {
                            onEditSong(song.id);
                          } else {
                            setEditingSongId(song.id);
                          }
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700 transition-colors cursor-pointer"
                      >
                        <Edit3 className="w-3 h-3 text-amber-400" />
                        <span>Edit</span>
                      </button>

                      {song.is_published ? (
                        <button
                          onClick={() => handleOpenUnpublish(song)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-950/30 hover:bg-amber-900/50 text-amber-300 border border-amber-600/40 transition-colors cursor-pointer"
                        >
                          <EyeOff className="w-3 h-3 text-amber-400" />
                          <span>Unpublish</span>
                        </button>
                      ) : null}

                      <button
                        onClick={() => handleOpenDelete(song)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-950/30 hover:bg-rose-900/50 text-rose-300 border border-rose-600/40 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3 text-rose-400" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination Controls */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-800 text-xs text-slate-400">
            <div>
              Showing <span className="font-semibold text-slate-200">{rangeStart}</span> to{' '}
              <span className="font-semibold text-slate-200">{rangeEnd}</span> of{' '}
              <span className="font-semibold text-slate-200">{totalCount}</span> songs
            </div>

            <div className="flex items-center gap-3">
              {/* Page size selector */}
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 text-[11px]">Per page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 text-xs outline-none"
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>

              {/* Navigation buttons */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1 || isLoading}
                  className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  title="Previous page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-2 py-1 text-slate-300 font-medium">
                  {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages || isLoading}
                  className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  title="Next page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Unpublish Confirmation Modal */}
      {unpublishTarget && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="unpublish-dialog-title"
        >
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-5 text-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 flex-shrink-0">
                  <EyeOff className="w-5 h-5" />
                </div>
                <div>
                  <h3 id="unpublish-dialog-title" className="text-base font-semibold text-slate-100">
                    Unpublish this song?
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Move song from published catalog to draft status
                  </p>
                </div>
              </div>
              <button
                onClick={handleCloseUnpublish}
                disabled={isUnpublishing}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                aria-label="Close unpublish dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2 text-xs">
              <div>
                <span className="text-slate-400 text-[11px] uppercase tracking-wide block">Title</span>
                <span className="font-semibold text-slate-200">{unpublishTarget.title}</span>
                {unpublishTarget.title_transliterated && (
                  <span className="text-slate-400 italic block text-[11px]">
                    {unpublishTarget.title_transliterated}
                  </span>
                )}
              </div>
              <div>
                <span className="text-slate-400 text-[11px] uppercase tracking-wide block">URL Slug</span>
                <code className="text-[11px] text-amber-300 font-mono">{unpublishTarget.slug}</code>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-950/20 border border-amber-500/30 text-xs text-amber-200/90 space-y-1.5">
              <p className="font-medium flex items-center gap-1.5 text-amber-300">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                What happens when unpublished:
              </p>
              <p className="text-[11px] leading-relaxed text-amber-200/80">
                The song will no longer appear in the public catalog, but all song data will be preserved.
                All lyrics, chords, songbooks, and media links remain intact and can be republished at any time.
              </p>
            </div>

            {unpublishError && (
              <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-500/40 text-xs text-rose-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                <span>{unpublishError}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={handleCloseUnpublish}
                disabled={isUnpublishing}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmUnpublish}
                disabled={isUnpublishing}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white shadow-lg transition-all disabled:opacity-50"
              >
                {isUnpublishing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Unpublishing...</span>
                  </>
                ) : (
                  <>
                    <EyeOff className="w-3.5 h-3.5" />
                    <span>Unpublish Song</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-dialog-title"
        >
          <div className="w-full max-w-lg bg-slate-900 border border-rose-500/30 rounded-2xl shadow-2xl p-6 space-y-5 text-slate-100 animate-in fade-in zoom-in-95 duration-150 my-8">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 flex-shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 id="delete-dialog-title" className="text-base font-semibold text-rose-200">
                    Delete Hymn Record
                  </h3>
                  <p className="text-xs text-rose-300/70 mt-0.5">
                    Permanent administrative removal under PostgreSQL RLS
                  </p>
                </div>
              </div>
              <button
                onClick={handleCloseDelete}
                disabled={isDeleting}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                aria-label="Close delete dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Song Summary */}
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2 text-xs">
              <div>
                <span className="text-slate-400 text-[11px] uppercase tracking-wide block">Song Title</span>
                <span className="font-semibold text-slate-200 text-sm">{deleteTarget.title}</span>
                {deleteTarget.title_transliterated && (
                  <span className="text-slate-400 italic block text-xs">
                    {deleteTarget.title_transliterated}
                  </span>
                )}
              </div>
              <div>
                <span className="text-slate-400 text-[11px] uppercase tracking-wide block">Identifier & URL Slug</span>
                <code className="text-xs text-rose-300 font-mono">{deleteTarget.slug}</code>
              </div>
            </div>

            {/* Warning Message */}
            <div className="p-3.5 rounded-xl bg-rose-950/30 border border-rose-500/40 text-xs text-rose-200 space-y-1">
              <p className="font-semibold flex items-center gap-1.5 text-rose-300">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                Warning: Destructive Operation
              </p>
              <p className="text-[11px] text-rose-200/80 leading-relaxed">
                This permanently deletes the song record. This action cannot be undone.
              </p>
            </div>

            {/* Relationship Status Section */}
            <div className="space-y-2">
              <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider block">
                Safety & Relationship Status
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                {/* Pinned Status */}
                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between gap-2">
                  <div>
                    <span className="text-[11px] text-slate-400 block">Today's Service</span>
                    <span className="font-medium text-slate-200">
                      {deleteEligibility.isLoading ? (
                        <span className="inline-flex items-center gap-1 text-slate-400">
                          <Loader2 className="w-3 h-3 animate-spin" /> Checking...
                        </span>
                      ) : deleteEligibility.isPinned ? (
                        <span className="text-amber-400 font-semibold">Pinned</span>
                      ) : (
                        <span className="text-emerald-400 font-semibold">Not pinned</span>
                      )}
                    </span>
                  </div>
                  {!deleteEligibility.isLoading && (
                    deleteEligibility.isPinned ? (
                      <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
                    ) : (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                    )
                  )}
                </div>

                {/* Songbooks Status */}
                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between gap-2">
                  <div>
                    <span className="text-[11px] text-slate-400 block">Songbook Associations</span>
                    <span className="font-medium text-slate-200">
                      {deleteEligibility.isLoading ? (
                        <span className="inline-flex items-center gap-1 text-slate-400">
                          <Loader2 className="w-3 h-3 animate-spin" /> Checking...
                        </span>
                      ) : deleteEligibility.songbookCount > 0 ? (
                        <span className="text-amber-400 font-semibold">
                          Assigned to {deleteEligibility.songbookCount} songbook{deleteEligibility.songbookCount === 1 ? '' : 's'}
                        </span>
                      ) : (
                        <span className="text-emerald-400 font-semibold">No associations</span>
                      )}
                    </span>
                  </div>
                  {!deleteEligibility.isLoading && (
                    deleteEligibility.songbookCount > 0 ? (
                      <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
                    ) : (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                    )
                  )}
                </div>
              </div>
            </div>

            {/* Blocked State Display */}
            {!deleteEligibility.isLoading && !deleteEligibility.canDelete && (
              <div className="p-4 rounded-xl bg-amber-950/25 border border-amber-500/40 text-xs text-amber-200 space-y-2">
                <div className="flex items-center gap-2 font-semibold text-amber-300">
                  <ShieldAlert className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  <span>Cannot delete while relationships exist</span>
                </div>
                <p className="text-[11px] text-amber-200/90 leading-relaxed">
                  {deleteEligibility.blockReason || 'Active relationships prevent deletion.'}
                </p>
                {deleteEligibility.songbookCount > 0 && (
                  <p className="text-[10px] text-amber-300/70 italic">
                    Songbook associations are managed separately (Phase 9B-6).
                  </p>
                )}
              </div>
            )}

            {/* Eligible State: Typed Confirmation */}
            {!deleteEligibility.isLoading && deleteEligibility.canDelete && (
              <div className="space-y-2 pt-1 border-t border-slate-800/80">
                <label className="text-xs font-semibold text-slate-300 block">
                  To permanently delete this hymn, type <span className="font-mono text-rose-400 font-bold">DELETE</span> in capital letters:
                </label>
                <input
                  type="text"
                  value={deleteConfirmInput}
                  onChange={(e) => setDeleteConfirmInput(e.target.value)}
                  placeholder="Type DELETE to confirm"
                  disabled={isDeleting}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-600 text-xs font-mono focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-colors"
                />
              </div>
            )}

            {deleteError && (
              <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-500/40 text-xs text-rose-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                <span>{deleteError}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={handleCloseDelete}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>

              {!deleteEligibility.isLoading && !deleteEligibility.canDelete ? (
                <button
                  type="button"
                  disabled
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-500 border border-slate-800 cursor-not-allowed opacity-50"
                >
                  Cannot delete while relationships exist
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={
                    deleteEligibility.isLoading ||
                    !deleteEligibility.canDelete ||
                    deleteConfirmInput !== 'DELETE' ||
                    isDeleting
                  }
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:cursor-not-allowed text-white shadow-lg transition-all"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Permanently Delete Song</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
