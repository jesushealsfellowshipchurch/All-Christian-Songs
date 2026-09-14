import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ArrowRight, X, Guitar, Video, Music } from 'lucide-react';
import { getSongSuggestions } from '../utils/search';

export default function HeroSection({
  searchQuery,
  setSearchQuery,
  onSearchSubmit,
  onSelectCategoryChip,
  songs = [],
  onSelectSong
}) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  const quickChips = [
    { label: 'యేసయ్య', query: 'యేసయ్య' },
    { label: 'ప్రార్థన', query: 'ప్రార్థన' },
    { label: 'ఆరాధన', query: 'ఆరాధన' },
    { label: 'క్రిస్మస్', query: 'Christmas' },
    { label: 'ఈస్టర్', query: 'Easter' },
    { label: 'బాలల పాటలు', query: 'Children' },
  ];

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Compute live accurate suggestions
  const suggestions = useMemo(() => {
    if (!searchQuery || !searchQuery.trim()) return [];
    return getSongSuggestions(songs, searchQuery, 8);
  }, [songs, searchQuery]);

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    setIsDropdownOpen(false);
    if (onSearchSubmit) onSearchSubmit(searchQuery);
    const catalogEl = document.getElementById('songs-catalog');
    if (catalogEl) {
      catalogEl.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleChipClick = (chip) => {
    setIsDropdownOpen(false);
    if (onSelectCategoryChip) {
      onSelectCategoryChip(chip);
    } else {
      setSearchQuery(chip.query);
      const catalogEl = document.getElementById('songs-catalog');
      if (catalogEl) {
        catalogEl.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  const handleSelectSuggestion = (song) => {
    setIsDropdownOpen(false);
    if (onSelectSong) {
      onSelectSong(song);
    }
  };

  return (
    <section className="relative z-30 w-full text-white pt-6 pb-6 sm:pt-8 sm:pb-8">
      {/* Background Image Container with Overlay */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <img
          src="./images/hero-bg.jpg"
          alt="Empty Tomb Sunrise Calvary"
          className="w-full h-full object-cover object-center scale-105 transform animate-pulse duration-[10000ms]"
        />
        {/* Cinematic Vignette and Dark Gradients */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/65 to-slate-950/80" />
        <div className="absolute inset-0 bg-radial-gradient from-transparent via-slate-950/50 to-slate-950/90" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-500/10 via-transparent to-transparent pointer-events-none" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Unified Hero Header Row: Left Calligraphy, Center Title & Subtitle, Right Calligraphy */}
        <div className="grid grid-cols-1 lg:grid-cols-12 items-center gap-2 xl:gap-6 mb-4 sm:mb-6">
          
          {/* Left Calligraphy: Sing to the Lord */}
          <div className="hidden lg:flex flex-col items-start justify-center lg:col-span-2 text-left opacity-90 hover:opacity-100 transition duration-300">
            <p className="font-script text-2xl xl:text-3xl text-amber-200/90 drop-shadow-md leading-relaxed tracking-wide">
              Sing to the Lord<br />
              <span className="text-xl xl:text-2xl text-amber-100/80 pl-2">a new song...</span>
            </p>
            <p className="font-serif italic text-[11px] tracking-widest text-amber-300/70 mt-1 pl-2 uppercase">
              Psalm 96:1
            </p>
          </div>

          {/* Center Main Titles */}
          <div className="lg:col-span-8 text-center px-1 sm:px-2">
            {/* Mobile-only compact scriptural verses badge to save space */}
            <div className="lg:hidden flex items-center justify-center gap-2 text-[11px] sm:text-xs font-script text-amber-200/80 mb-2">
              <span>Sing to the Lord (Ps 96:1)</span>
              <span className="text-amber-400">•</span>
              <span>He is Risen (Mt 28:6)</span>
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-5xl xl:text-6xl font-telugu-serif font-bold sm:font-extrabold not-italic text-transparent bg-clip-text bg-gradient-to-r from-amber-100 via-amber-300 to-yellow-500 drop-shadow-[0_4px_22px_rgba(245,158,11,0.45)] tracking-wide leading-normal py-1 sm:whitespace-nowrap">
              సార్వత్రిక క్రైస్తవ కీర్తనలు
            </h1>
            <h2 className="mt-0.5 sm:mt-1 text-base sm:text-xl md:text-2xl font-semibold tracking-wide text-white drop-shadow-md">
              All Christian Songs
            </h2>
            <p className="mt-2 text-[11px] sm:text-xs font-medium tracking-widest uppercase text-amber-200/80 flex items-center justify-center gap-2 sm:gap-2.5 flex-wrap">
              <span>Discover</span>
              <span className="text-gold-500">•</span>
              <span>Worship</span>
              <span className="text-gold-500">•</span>
              <span>Sing</span>
              <span className="text-gold-500">•</span>
              <span>Share His Love</span>
            </p>
          </div>

          {/* Right Calligraphy: He is Risen */}
          <div className="hidden lg:flex flex-col items-end justify-center lg:col-span-2 text-right opacity-90 hover:opacity-100 transition duration-300">
            <p className="font-script text-2xl xl:text-3xl text-amber-200/90 drop-shadow-md leading-relaxed tracking-wide">
              He is Risen
            </p>
            <p className="font-serif italic text-[11px] tracking-widest text-amber-300/70 mt-1 uppercase">
              Matthew 28:6
            </p>
          </div>

        </div>

        {/* Central Search Bar & Suggestions Container */}
        <div ref={containerRef} className="relative max-w-2xl mx-auto mt-4 sm:mt-6">
          <form
            onSubmit={handleSubmit}
            className="relative flex items-center bg-slate-900/85 backdrop-blur-xl border border-amber-400/35 hover:border-amber-400/60 focus-within:border-amber-400 focus-within:ring-4 focus-within:ring-amber-400/20 rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.5)] transition-all duration-200 group"
          >
            <div className="pl-5 text-amber-400/90 group-focus-within:text-amber-300">
              <Search className="w-5 h-5" />
            </div>

            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsDropdownOpen(true);
              }}
              onFocus={() => setIsDropdownOpen(true)}
              placeholder="Search 3,773 songs by number, Telugu or English..."
              className="w-full py-3.5 sm:py-4 pl-3 pr-24 text-sm sm:text-base text-white placeholder-slate-400/80 bg-transparent focus:outline-none"
            />

            {/* Clear Button */}
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  if (inputRef.current) inputRef.current.focus();
                }}
                className="absolute right-14 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white transition"
                title="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}

            <button
              type="submit"
              className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 flex items-center justify-center shadow-md transition transform hover:scale-105 active:scale-95"
              title="Search"
            >
              <ArrowRight className="w-5 h-5" />
            </button>
          </form>

          {/* Live Accurate Suggestions Dropdown */}
          {isDropdownOpen && searchQuery.trim().length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-amber-400/30 overflow-hidden z-50 max-h-80 overflow-y-auto divide-y divide-slate-800">
              <div className="px-4 py-2.5 bg-slate-800/80 border-b border-slate-700/80 flex items-center justify-between text-xs text-slate-300">
                <span className="flex items-center gap-1.5 font-medium">
                  <Music className="w-3.5 h-3.5 text-amber-400" />
                  Suggested Songs ({suggestions.length})
                </span>
                <span className="text-[11px] text-amber-300/80">Click to open & view lyrics</span>
              </div>

              {suggestions.length === 0 ? (
                <div className="p-6 text-center text-sm text-slate-400">
                  No matching songs found for "{searchQuery}"
                </div>
              ) : (
                suggestions.map((song) => (
                  <div
                    key={song.id}
                    onClick={() => handleSelectSuggestion(song)}
                    className="p-3 sm:px-4 hover:bg-slate-800/80 cursor-pointer transition flex items-center justify-between gap-3 text-left group"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <h4 className="text-sm font-bold font-telugu text-white group-hover:text-amber-300 transition truncate">
                          {song.t}
                        </h4>
                      </div>
                      {song.tr && song.tr !== song.t && (
                        <p className="text-xs text-slate-400 truncate mt-0.5">
                          {song.tr}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                          {song.lang}
                        </span>
                        {song.chords && (
                          <span className="text-[10px] font-semibold text-amber-400 flex items-center gap-0.5">
                            <Guitar className="w-2.5 h-2.5" /> Chords
                          </span>
                        )}
                        {song.video && (
                          <span className="text-[10px] font-semibold text-rose-400 flex items-center gap-0.5">
                            <Video className="w-2.5 h-2.5" /> Media
                          </span>
                        )}
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-amber-400 group-hover:translate-x-0.5 transition shrink-0" />
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Quick Search Chips */}
        <div className="mt-4 sm:mt-5 flex items-center justify-center gap-2 sm:gap-2.5 flex-wrap">
          {quickChips.map((chip, idx) => (
            <button
              key={idx}
              onClick={() => handleChipClick(chip)}
              className="px-3.5 py-1.5 rounded-full text-xs font-medium font-telugu bg-slate-900/60 hover:bg-amber-500/20 text-slate-300 hover:text-amber-200 border border-slate-700/60 hover:border-amber-400/40 backdrop-blur-sm transition-all duration-150 transform hover:scale-105 active:scale-95 shadow-sm"
            >
              {chip.label}
            </button>
          ))}
        </div>

      </div>
    </section>
  );
}
