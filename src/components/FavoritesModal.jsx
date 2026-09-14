import React from 'react';
import { X, Heart, Music, Trash2, ArrowRight } from 'lucide-react';

export default function FavoritesModal({
  isOpen,
  onClose,
  favorites = [],
  allSongs = [],
  onSelectSong,
  onRemoveFavorite
}) {
  if (!isOpen) return null;

  const favoriteSongs = allSongs.filter(s => favorites.includes(s.id));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg rounded-3xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-slate-900 via-slate-850 to-rose-950/30 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <Heart className="w-4 h-4 fill-rose-500" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-wide">
                Favorite Songs ({favoriteSongs.length})
              </h3>
              <p className="text-xs text-slate-400">
                Quick access to your saved songs
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Song List */}
        <div className="p-4 flex-1 overflow-y-auto divide-y divide-slate-800">
          {favoriteSongs.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-3">
              <Heart className="w-12 h-12 text-slate-600 mx-auto stroke-1" />
              <p className="text-sm font-semibold">No favorite songs added yet</p>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Tap the heart icon on any song card to save your favorite songs here for easy access.
              </p>
            </div>
          ) : (
            favoriteSongs.map((song) => (
              <div
                key={song.id}
                className="py-3 px-2 flex items-center justify-between gap-3 hover:bg-slate-800/60 rounded-xl transition group cursor-pointer"
                onClick={() => {
                  if (onSelectSong) onSelectSong(song);
                  onClose();
                }}
              >
                <div className="min-w-0 flex-1">
                  <h4 className="font-telugu font-bold text-sm text-white group-hover:text-amber-300 truncate">
                    {song.t}
                  </h4>
                  {song.tr && song.tr !== song.t && (
                    <p className="text-xs text-slate-400 truncate mt-0.5 font-sans">
                      {song.tr}
                    </p>
                  )}
                  <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 inline-block mt-1">
                    {song.lang}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onRemoveFavorite) onRemoveFavorite(song.id);
                    }}
                    className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-slate-700/50 transition"
                    title="Remove from favorites"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-amber-400 transition" />
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-full text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white transition"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
