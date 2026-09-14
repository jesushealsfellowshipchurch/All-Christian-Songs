import React, { useState, useEffect } from 'react';
import { Guitar, Video, FileText, ChevronRight, Play, Music, Sparkles, Heart } from 'lucide-react';
import BrowseByCategory from './BrowseByCategory';
import BrowseByLetter from './BrowseByLetter';

const PAGE_SIZE = 36;

export default function SongList({
  songs,
  selectedSongId,
  onSelectSong,
  onQuickPlay,
  alphabet,
  setAlphabet,
  activeSongbook,
  onClearSongbook,
  currentLanguage = 'all',
  activeCategory,
  onSelectCategory,
  allSongs = [],
  favorites = [],
  onToggleFavorite
}) {
  const [currentPage, setCurrentPage] = useState(1);

  // Reset to page 1 when songs array changes
  useEffect(() => {
    setCurrentPage(1);
  }, [songs.length, alphabet, activeCategory, activeSongbook]);

  const totalPages = Math.ceil(songs.length / PAGE_SIZE) || 1;
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const currentSongs = songs.slice(startIndex, startIndex + PAGE_SIZE);

  return (
    <div id="songs-catalog" className="space-y-6 pt-4">
      
      {/* Active Songbook banner if filtered */}
      {activeSongbook && (
        <div className="flex items-center justify-between p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-900 rounded-xl text-sm">
          <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200">
            <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span>Browsing Songbook: <strong>{activeSongbook.title}</strong></span>
          </div>
          <button
            onClick={onClearSongbook}
            className="text-xs font-semibold text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-200 underline"
          >
            Show All Songs
          </button>
        </div>
      )}

      {/* Browse by Category */}
      <div id="categories-section">
        <BrowseByCategory
          songs={allSongs.length > 0 ? allSongs : songs}
          activeCategory={activeCategory}
          onSelectCategory={onSelectCategory}
        />
      </div>

      {/* Browse by Letter (Telugu Aksharamulu, English & Hindi) */}
      <BrowseByLetter
        activeLetter={alphabet}
        onSelectLetter={setAlphabet}
        currentLanguage={currentLanguage}
      />

      {/* Results Header */}
      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1">
        <span>
          Showing <strong className="text-slate-900 dark:text-white">{songs.length > 0 ? startIndex + 1 : 0}</strong> - <strong className="text-slate-900 dark:text-white">{Math.min(startIndex + PAGE_SIZE, songs.length)}</strong> of <strong className="text-slate-900 dark:text-white">{songs.length}</strong> songs
        </span>
        {totalPages > 1 && (
          <span>Page {currentPage} of {totalPages}</span>
        )}
      </div>

      {/* Songs Grid */}
      {songs.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 shadow-sm">
          <Music className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-700 mb-3" />
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">No songs found</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
            Try adjusting your search terms, changing the language filter, or clearing the alphabet filter.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {currentSongs.map((song) => {
            const isSelected = selectedSongId === song.id || selectedSongId === song.slug;
            return (
              <div
                key={song.id}
                onClick={() => onSelectSong(song)}
                className={`group relative flex flex-col justify-between p-4 rounded-xl border transition cursor-pointer text-left ${
                  isSelected
                    ? 'bg-brand-50/70 dark:bg-brand-950/40 border-brand-500 dark:border-brand-500 shadow-sm ring-1 ring-brand-500'
                    : 'bg-white dark:bg-slate-900/90 border-slate-200/80 dark:border-slate-800 hover:border-brand-300 dark:hover:border-brand-800 hover:shadow-md'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    {/* Title in original script */}
                    <h3 className="text-base font-bold font-telugu text-slate-900 dark:text-white leading-snug group-hover:text-amber-500 dark:group-hover:text-amber-400 transition">
                      {song.t}
                    </h3>

                    {/* Favorite Heart Toggle */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onToggleFavorite) onToggleFavorite(song.id);
                      }}
                      className="p-1 text-slate-400 hover:text-rose-500 rounded-md transition shrink-0"
                      title={favorites.includes(song.id) ? "Remove from favorites" : "Add to favorites"}
                    >
                      <Heart
                        className={`w-3.5 h-3.5 ${
                          favorites.includes(song.id)
                            ? 'text-rose-500 fill-rose-500'
                            : 'text-slate-400 hover:text-rose-400'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Transliterated English title */}
                  {song.tr && song.tr !== song.t && (
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5 tracking-wide">
                      {song.tr}
                    </p>
                  )}

                  {/* Author / Composer */}
                  {song.auth && (
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 italic">
                      by {song.auth}
                    </p>
                  )}
                </div>

                {/* Footer Badges & Actions */}
                <div className="flex items-center justify-between mt-3.5 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 text-[11px]">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Language Badge */}
                    <span className="px-1.5 py-0.5 rounded font-medium uppercase tracking-wider text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      {song.lang}
                    </span>

                    {/* Chords Badge */}
                    {song.chords && (
                      <span className="flex items-center gap-1 px-1.5 py-0.5 rounded font-medium bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-900/50">
                        <Guitar className="w-3 h-3" />
                        <span>Chords</span>
                      </span>
                    )}

                    {/* Video / Audio Badge */}
                    {song.video && (
                      <span className="flex items-center gap-1 px-1.5 py-0.5 rounded font-medium bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-900/50">
                        <Video className="w-3 h-3" />
                        <span>Media</span>
                      </span>
                    )}

                    {/* PPT Badge */}
                    {song.ppt && (
                      <span className="flex items-center gap-1 px-1.5 py-0.5 rounded font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-900/50">
                        <FileText className="w-3 h-3" />
                        <span>PPT</span>
                      </span>
                    )}
                  </div>

                  {/* Play Video Quick button */}
                  {song.yt && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onQuickPlay(song);
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition"
                      title="Play Audio / Video"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4 pb-12">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-800 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            Previous
          </button>
          <span className="text-xs font-medium text-slate-500 px-3">
            {currentPage} / {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-800 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            Next
          </button>
        </div>
      )}

    </div>
  );
}
