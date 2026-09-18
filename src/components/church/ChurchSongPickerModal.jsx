import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  Search,
  Plus,
  Check,
  Music,
  Loader2,
  AlertCircle,
  FileMusic,
  Video,
  ChevronRight,
  Filter
} from 'lucide-react';
import { getCatalogIndex } from '../../services/catalogRepository';
import { filterSongs } from '../../utils/search';

export default function ChurchSongPickerModal({
  isOpen,
  onClose,
  collectionName = 'Church Repertoire',
  existingSongIds = new Set(),
  onAddSong
}) {
  const [allSongs, setAllSongs] = useState([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('all');
  const [addingSongId, setAddingSongId] = useState(null);
  const [addFeedback, setAddFeedback] = useState({ type: '', message: '' });
  const searchInputRef = useRef(null);

  // Load catalog on open if not already loaded
  useEffect(() => {
    let isMounted = true;
    if (isOpen) {
      setSearchQuery('');
      setAddFeedback({ type: '', message: '' });
      if (allSongs.length === 0) {
        setLoadingCatalog(true);
        getCatalogIndex()
          .then(({ songs }) => {
            if (isMounted) {
              setAllSongs(songs || []);
              setLoadingCatalog(false);
            }
          })
          .catch((err) => {
            if (isMounted) {
              console.error('[ChurchSongPickerModal] Failed to load catalog index:', err);
              setLoadingCatalog(false);
            }
          });
      }

      // Auto-focus search on desktop
      setTimeout(() => {
        if (searchInputRef.current && window.innerWidth > 640) {
          searchInputRef.current.focus();
        }
      }, 100);
    }
    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // Client-side search and filtering using filterSongs utility
  const filteredSongs = useMemo(() => {
    if (!allSongs || allSongs.length === 0) return [];
    return filterSongs(allSongs, {
      query: searchQuery,
      language: selectedLanguage,
      filterType: 'all'
    });
  }, [allSongs, searchQuery, selectedLanguage]);

  // Paginated view for smooth rendering performance (initial 40 songs, increases on scroll)
  const [displayCount, setDisplayCount] = useState(40);
  useEffect(() => {
    setDisplayCount(40);
  }, [searchQuery, selectedLanguage]);

  const displayedSongs = useMemo(() => {
    return filteredSongs.slice(0, displayCount);
  }, [filteredSongs, displayCount]);

  if (!isOpen) return null;

  const handleAdd = async (song) => {
    if (existingSongIds.has(song.id)) return;
    setAddingSongId(song.id);
    setAddFeedback({ type: '', message: '' });

    try {
      const res = await onAddSong(song.id, {
        default_key: null,
        tempo_notes: null,
        arrangement_notes: null
      });

      if (res && res.error) {
        setAddFeedback({ type: 'error', message: res.error });
      } else {
        setAddFeedback({
          type: 'success',
          message: `Added "${song.t}" to ${collectionName}`
        });
        // Clear message after 3 seconds
        setTimeout(() => {
          setAddFeedback((prev) => (prev.message.includes(song.t) ? { type: '', message: '' } : prev));
        }, 3000);
      }
    } catch (err) {
      setAddFeedback({ type: 'error', message: err?.message || 'Failed to add song.' });
    } finally {
      setAddingSongId(null);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="song-picker-title"
      className="fixed inset-0 z-[110] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-2.5 sm:p-6 animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-900/95 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
              <Music className="w-5 h-5 text-amber-400" />
            </div>
            <div className="min-w-0">
              <h3 id="song-picker-title" className="text-base sm:text-lg font-bold text-white truncate">
                Add Songs to Collection
              </h3>
              <p className="text-xs text-slate-400 truncate">
                Target: <span className="font-semibold text-amber-300">{collectionName}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close song picker"
            className="w-11 h-11 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 flex items-center justify-center transition shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback Alert Bar */}
        {addFeedback.message && (
          <div
            className={`px-4 py-2.5 text-xs font-semibold flex items-center gap-2 border-b shrink-0 ${
              addFeedback.type === 'error'
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
            }`}
          >
            {addFeedback.type === 'error' ? (
              <AlertCircle className="w-4 h-4 shrink-0" />
            ) : (
              <Check className="w-4 h-4 shrink-0" />
            )}
            <span className="truncate">{addFeedback.message}</span>
          </div>
        )}

        {/* Search & Filter Bar */}
        <div className="p-3 sm:p-4 bg-slate-900/80 border-b border-slate-800 space-y-2.5 shrink-0">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title, transliteration, lyrics, or author..."
              className="w-full pl-10 pr-9 py-2.5 rounded-2xl bg-slate-800/90 border border-slate-700 text-sm text-white placeholder-slate-400 focus:ring-2 focus:ring-amber-400/50 outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search query"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Language Selection Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar text-xs">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
              <Filter className="w-3 h-3 text-amber-400" />
              <span>Lang:</span>
            </span>
            {['all', 'telugu', 'english', 'hindi'].map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => setSelectedLanguage(lang)}
                className={`px-3 py-1 rounded-xl font-semibold capitalize transition shrink-0 ${
                  selectedLanguage === lang
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700/60'
                }`}
              >
                {lang === 'all' ? 'All Languages' : lang}
              </button>
            ))}
            <span className="ml-auto text-[11px] text-slate-400 font-mono shrink-0 pl-2">
              {filteredSongs.length} found
            </span>
          </div>
        </div>

        {/* Scrollable Song List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-800/80 p-2 sm:p-3">
          {loadingCatalog ? (
            <div className="py-16 text-center text-slate-400 text-sm flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
              <span>Loading song catalog index...</span>
            </div>
          ) : displayedSongs.length === 0 ? (
            <div className="py-16 text-center text-slate-400 space-y-2">
              <Music className="w-10 h-10 text-slate-600 mx-auto stroke-1" />
              <p className="text-sm font-semibold text-slate-300">No matching songs found</p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Try searching by transliterated English keywords or clearing your language filter.
              </p>
            </div>
          ) : (
            displayedSongs.map((song) => {
              const isAlreadyInCollection = existingSongIds.has(song.id);
              const isAdding = addingSongId === song.id;

              return (
                <div
                  key={song.id}
                  className={`p-3 rounded-2xl transition flex items-center justify-between gap-3 ${
                    isAlreadyInCollection
                      ? 'bg-slate-800/20 opacity-75'
                      : 'hover:bg-slate-800/60'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-telugu font-bold text-sm text-white group-hover:text-amber-300 truncate">
                        {song.t}
                      </h4>
                      <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700/60">
                        {song.lang}
                      </span>
                      {song.chords && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1">
                          <FileMusic className="w-2.5 h-2.5" /> Chords
                        </span>
                      )}
                      {song.video && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1">
                          <Video className="w-2.5 h-2.5" /> Video
                        </span>
                      )}
                    </div>

                    {song.tr && song.tr !== song.t && (
                      <p className="text-xs text-slate-400 truncate mt-0.5 font-sans">
                        {song.tr}
                      </p>
                    )}

                    {song.auth && (
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">
                        Author: {song.auth}
                      </p>
                    )}
                  </div>

                  {/* Add / Added Button */}
                  <div className="shrink-0">
                    {isAlreadyInCollection ? (
                      <span className="min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5" />
                        <span>In Collection</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleAdd(song)}
                        disabled={isAdding}
                        aria-label={`Add ${song.t} to collection`}
                        className="min-h-[44px] min-w-[44px] px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
                      >
                        {isAdding ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}

          {/* Load More Button for large result sets */}
          {filteredSongs.length > displayCount && (
            <div className="p-3 text-center">
              <button
                type="button"
                onClick={() => setDisplayCount((prev) => prev + 40)}
                className="min-h-[44px] px-4 py-2 text-xs font-bold text-amber-400 hover:text-amber-300 rounded-xl bg-slate-800/80 hover:bg-slate-700 transition"
              >
                Load More Results ({filteredSongs.length - displayCount} remaining)
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 bg-slate-950/90 border-t border-slate-800 flex items-center justify-between gap-3 text-xs text-slate-400 shrink-0">
          <span className="truncate">
            Hymns added link to the church collection without duplicating catalog data.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition shrink-0"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
}
