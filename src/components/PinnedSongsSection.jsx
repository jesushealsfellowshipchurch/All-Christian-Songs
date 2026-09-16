import React, { useState, useEffect } from 'react';
import { Pin, Video, ChevronRight, X, Sparkles, Music, ArrowUpDown } from 'lucide-react';
import { getPinnedSongs, unpinSong, updatePinNumber } from '../utils/pinManager';

export default function PinnedSongsSection({
  onSelectSong,
  onQuickPlay,
  isAdmin,
  allSongs = []
}) {
  const [pinnedSongs, setPinnedSongs] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [tempNum, setTempNum] = useState('');

  const loadPinned = () => {
    setPinnedSongs(getPinnedSongs());
  };

  useEffect(() => {
    loadPinned();
    const handleSync = () => loadPinned();
    window.addEventListener('jhf_pinned_songs_changed', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('jhf_pinned_songs_changed', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  if (pinnedSongs.length === 0) {
    if (!isAdmin) return null;
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        <div className="p-4 bg-amber-500/5 border border-dashed border-amber-500/30 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-amber-300">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
              <Pin className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-amber-300 text-sm">No Pinned Worship Songs Yet</p>
              <p className="text-slate-400 text-xs">
                As Admin, open any song detail view and click the <strong>Pin (📌)</strong> icon to highlight today's service songs here!
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handleSavePinNumber = (songId) => {
    if (tempNum) {
      updatePinNumber(songId, tempNum);
    }
    setEditingId(null);
  };

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 mb-2 animate-fadeIn">
      <div className="relative p-5 sm:p-6 bg-gradient-to-br from-slate-900 via-slate-900/90 to-amber-950/30 border border-amber-500/30 rounded-3xl shadow-xl overflow-hidden">
        {/* Glow ambient background decoration */}
        <div className="absolute -top-16 -right-16 w-48 h-48 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 border-b border-amber-500/20 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center shadow-lg shadow-amber-500/20 shrink-0 font-extrabold">
              <Pin className="w-5 h-5 fill-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg sm:text-xl font-bold text-white tracking-wide flex items-center gap-2 font-telugu">
                  ఈనాటి ఆరాధన పాటలు
                  <span className="text-sm font-sans font-medium text-amber-300 hidden sm:inline">• Today's Service Pinned Songs</span>
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {pinnedSongs.length} {pinnedSongs.length === 1 ? 'Song' : 'Songs'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Featured order of worship selected for the congregation and choir
              </p>
            </div>
          </div>

          {isAdmin && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400 italic">Admin Controls Active</span>
            </div>
          )}
        </div>

        {/* Pinned Songs Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {pinnedSongs.map((song) => (
            <div
              key={song.id || song.slug}
              onClick={() => onSelectSong && onSelectSong(song)}
              className="group relative p-4 bg-slate-950/70 hover:bg-slate-900 border border-amber-500/25 hover:border-amber-400 rounded-2xl transition-all duration-200 cursor-pointer shadow-md hover:shadow-xl hover:shadow-amber-500/10 flex flex-col justify-between"
            >
              <div>
                {/* Header: Pin Number & Actions */}
                <div className="flex items-center justify-between gap-2 mb-2.5">
                  <div className="flex items-center gap-1.5">
                    <span className="px-2.5 py-1 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 text-xs font-black shadow-sm flex items-center gap-1 tracking-wide">
                      <Pin className="w-3 h-3 fill-slate-950" />
                      <span>#{song.pinNumber || 1}</span>
                    </span>

                    {isAdmin && editingId !== song.id && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingId(song.id);
                          setTempNum(String(song.pinNumber || 1));
                        }}
                        className="p-1 text-slate-400 hover:text-amber-300 rounded hover:bg-slate-800 transition text-[11px]"
                        title="Change Pin Order"
                      >
                        <ArrowUpDown className="w-3 h-3" />
                      </button>
                    )}

                    {isAdmin && editingId === song.id && (
                      <div
                        className="flex items-center gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="number"
                          value={tempNum}
                          onChange={(e) => setTempNum(e.target.value)}
                          className="w-12 px-1.5 py-0.5 text-xs bg-slate-900 border border-amber-500 text-white rounded focus:outline-none"
                          min="1"
                        />
                        <button
                          type="button"
                          onClick={() => handleSavePinNumber(song.id)}
                          className="px-1.5 py-0.5 bg-amber-500 text-slate-950 text-[10px] font-bold rounded"
                        >
                          Save
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    {/* Language Badge */}
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-slate-300 border border-slate-700/50">
                      {song.language || 'Telugu'}
                    </span>

                    {/* Unpin button for Admin */}
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          unpinSong(song.id, song.slug);
                        }}
                        className="p-1 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition"
                        title="Unpin from landing page"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Song Title in Telugu */}
                <h4 className="text-base font-bold text-white font-telugu leading-snug group-hover:text-amber-400 transition">
                  {song.title}
                </h4>

                {/* Transliterated English Title */}
                {song.title_transliterated && song.title_transliterated !== song.title && (
                  <p className="text-xs font-medium text-slate-400 mt-1 line-clamp-1">
                    {song.title_transliterated}
                  </p>
                )}

                {/* Author */}
                {song.author && (
                  <p className="text-[11px] text-slate-500 mt-1.5 italic line-clamp-1">
                    by {song.author}
                  </p>
                )}
              </div>

              {/* Card Footer */}
              <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-800/80 text-xs">
                <span className="text-[11px] text-amber-400/90 font-medium flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                  View Lyrics & Chords <ChevronRight className="w-3 h-3" />
                </span>

                {song.youtube_id && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onQuickPlay) onQuickPlay(song);
                    }}
                    className="p-1.5 text-rose-400 hover:text-rose-300 bg-rose-950/40 hover:bg-rose-900/60 rounded-xl border border-rose-500/20 transition flex items-center gap-1 text-[11px]"
                    title="Play Audio / Video"
                  >
                    <Video className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Play</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
