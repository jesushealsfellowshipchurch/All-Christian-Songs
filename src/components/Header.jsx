import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, X, Moon, Sun, Heart, Menu, ArrowLeft, ArrowRight, Guitar, Video, BookOpen, Globe, Music, Lock, Plus, ShieldCheck } from 'lucide-react';
import { getSongSuggestions } from '../utils/search';
import { useFeatures } from '../context/FeatureContext';

export default function Header({
  searchQuery,
  setSearchQuery,
  language,
  setLanguage,
  filterType,
  setFilterType,
  darkMode,
  setDarkMode,
  totalCount,
  filteredCount,
  onOpenSongbooks,
  songs = [],
  onSelectSong,
  favoritesCount = 0,
  onOpenFavorites,
  onOpenAbout,
  isAdmin = false,
  onOpenAdmin
}) {
  const { isFeatureEnabled } = useFeatures();
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const searchInputRef = useRef(null);
  const desktopSearchInputRef = useRef(null);
  const searchContainerRef = useRef(null);
  const desktopSearchContainerRef = useRef(null);

  // Auto focus input when mobile search opens
  useEffect(() => {
    if (isMobileSearchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isMobileSearchOpen]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target) &&
        desktopSearchContainerRef.current &&
        !desktopSearchContainerRef.current.contains(e.target)
      ) {
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

  const handleOpenSearch = () => {
    setIsMobileSearchOpen(true);
    setIsDropdownOpen(true);
  };

  const handleCloseSearch = () => {
    setIsMobileSearchOpen(false);
    setIsDropdownOpen(false);
  };

  const handleSelectFromSearch = (song) => {
    if (onSelectSong) {
      onSelectSong(song);
    }
    setIsDropdownOpen(false);
    setIsMobileSearchOpen(false);
  };

  const scrollToSection = (id) => {
    setIsMobileMenuOpen(false);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-slate-950/95 dark:bg-slate-950/95 backdrop-blur-md border-b border-slate-800/80 transition-colors shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Main Navbar Row */}
        <div className="flex items-center justify-between h-18 py-2.5 gap-4">
          
          {/* Mobile Full-Width Search Mode */}
          {isMobileSearchOpen ? (
            <div className="flex items-center w-full gap-2 py-1" ref={searchContainerRef}>
              <button
                onClick={handleCloseSearch}
                className="p-2 -ml-1 text-slate-300 hover:bg-slate-800 rounded-xl transition shrink-0"
                title="Back"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>

              <div className="flex-1 relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setIsDropdownOpen(true);
                  }}
                  onFocus={() => setIsDropdownOpen(true)}
                  placeholder={`Search ${totalCount ? totalCount.toLocaleString() : '3,773'} songs by Telugu or English...`}
                  className="w-full pl-10 pr-9 py-2 text-sm bg-slate-900 border border-slate-700 rounded-full text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400/50 shadow-inner"
                />
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      if (searchInputRef.current) searchInputRef.current.focus();
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}

                {/* Instant Live Search Results Dropdown (Mobile Full) */}
                {isDropdownOpen && searchQuery.trim().length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900 rounded-2xl shadow-2xl border border-amber-400/30 overflow-hidden z-50 max-h-[75vh] overflow-y-auto">
                    <div className="p-2.5 bg-slate-800/80 border-b border-slate-700 flex items-center justify-between text-xs text-slate-300">
                      <span className="flex items-center gap-1.5 font-medium">
                        <Music className="w-3.5 h-3.5 text-amber-400" />
                        Suggested Songs ({suggestions.length})
                      </span>
                      <span className="text-[11px] text-amber-300/80">Tap to open lyrics</span>
                    </div>

                    {suggestions.length === 0 ? (
                      <div className="p-6 text-center text-sm text-slate-400">
                        No matching songs for "{searchQuery}"
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-800">
                        {suggestions.map((song) => (
                          <div
                            key={song.id}
                            onClick={() => handleSelectFromSearch(song)}
                            className="p-3.5 hover:bg-slate-800/70 cursor-pointer transition flex items-center justify-between gap-3 text-left"
                          >
                            <div className="min-w-0 flex-1">
                              <h4 className="text-sm font-bold font-telugu text-white truncate">
                                {song.t}
                              </h4>
                              {song.tr && song.tr !== song.t && (
                                <p className="text-xs text-slate-400 truncate mt-0.5">
                                  {song.tr}
                                </p>
                              )}
                              <div className="flex items-center gap-1.5 mt-1">
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
                            <ArrowRight className="w-4 h-4 text-slate-500 shrink-0" />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* Brand Logo with Glowing Cross */}
              <div 
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="flex items-center gap-3 cursor-pointer select-none group shrink-0"
              >
                <div className="relative flex items-center justify-center">
                  <div className="absolute inset-0 bg-amber-400/20 rounded-full blur-md group-hover:bg-amber-400/30 transition" />
                  <img
                    src="./images/gold-cross.png"
                    alt="Gold Cross"
                    className="relative w-9 h-9 sm:w-10 sm:h-10 object-contain drop-shadow-[0_0_12px_rgba(203,182,130,0.6)] group-hover:scale-105 transition-transform duration-200"
                  />
                </div>
                <div className="text-left">
                  <h1 className="text-base sm:text-lg font-bold tracking-tight text-white group-hover:text-amber-300 transition">
                    All Christian Songs
                  </h1>
                  <p className="text-[10px] sm:text-[11px] text-slate-400 font-medium tracking-wider">
                    Worship • Lyrics • Share • Grow
                  </p>
                </div>
              </div>

              {/* Desktop Navigation Links Pill */}
              <nav className="hidden lg:flex items-center gap-0.5 xl:gap-1 px-2 py-1 rounded-full bg-slate-900/80 border border-slate-800 shadow-inner shrink-0">
                <button
                  onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                  className="px-2.5 xl:px-3.5 py-1.5 rounded-full text-xs font-semibold text-white bg-slate-800 shadow-sm transition"
                >
                  Home
                </button>
                <button
                  onClick={() => scrollToSection('songs-catalog')}
                  className="px-2.5 xl:px-3.5 py-1.5 rounded-full text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800/60 transition"
                >
                  Songs
                </button>
                <button
                  onClick={() => scrollToSection('categories-section')}
                  className="px-2.5 xl:px-3.5 py-1.5 rounded-full text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800/60 transition"
                >
                  Categories
                </button>
                {/* Videos link commented out, can be enabled anytime:
                <button
                  onClick={() => scrollToSection('youtube')}
                  className="px-3.5 py-1.5 rounded-full text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800/60 transition flex items-center gap-1.5"
                >
                  <Video className="w-3.5 h-3.5 text-rose-400" />
                  <span>Videos</span>
                </button>
                */}
                {isFeatureEnabled('personal_favorites') && (
                  <button
                    onClick={onOpenFavorites}
                    className="px-2.5 xl:px-3 py-1.5 rounded-full text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800/60 transition flex items-center gap-1.5"
                  >
                    <Heart className="w-3.5 h-3.5 text-rose-400 fill-rose-400 shrink-0" />
                    <span className="hidden xl:inline">Favorites</span>
                    {favoritesCount > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                        {favoritesCount}
                      </span>
                    )}
                  </button>
                )}
                <button
                  onClick={onOpenAbout}
                  className="px-2.5 xl:px-3.5 py-1.5 rounded-full text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800/60 transition"
                >
                  About
                </button>
                <button
                  onClick={onOpenAdmin}
                  className={`px-2.5 xl:px-3.5 py-1.5 rounded-full text-xs font-semibold transition flex items-center gap-1.5 ${
                    isAdmin 
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30' 
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                  }`}
                  title={isAdmin ? "Admin Portal (Signed In)" : "Admin Portal (Sign In)"}
                >
                  {isAdmin ? (
                    <>
                      <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                      <span>Admin</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-3.5 h-3.5 text-slate-400" />
                      <span>Admin</span>
                    </>
                  )}
                </button>
              </nav>

              {/* Desktop Search Input with Suggestions Dropdown */}
              <div ref={desktopSearchContainerRef} className="hidden md:block relative min-w-[180px] lg:min-w-[200px] xl:min-w-[260px] max-w-xs lg:max-w-sm flex-1 mx-2">
                <div className="relative flex items-center">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-400/90 pointer-events-none" />
                  <input
                    ref={desktopSearchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setIsDropdownOpen(true);
                    }}
                    onFocus={() => setIsDropdownOpen(true)}
                    placeholder="Search songs or number..."
                    className="w-full pl-10 pr-8 py-2 text-xs sm:text-sm bg-slate-900/90 border border-slate-700/80 rounded-full text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400/50 shadow-inner transition leading-normal"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        if (desktopSearchInputRef.current) desktopSearchInputRef.current.focus();
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Desktop Dropdown */}
                {isDropdownOpen && searchQuery.trim().length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900 rounded-2xl shadow-2xl border border-amber-400/30 overflow-hidden z-50 max-h-80 overflow-y-auto divide-y divide-slate-800">
                    <div className="p-2.5 bg-slate-800/90 border-b border-slate-700 flex items-center justify-between text-xs text-slate-300">
                      <span className="flex items-center gap-1.5 font-medium">
                        <Music className="w-3 h-3 text-amber-400" />
                        Suggested Songs ({suggestions.length})
                      </span>
                      <span className="text-[10px] text-amber-300/80">Click to open</span>
                    </div>

                    {suggestions.length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-400">
                        No matching songs for "{searchQuery}"
                      </div>
                    ) : (
                      suggestions.map((song) => (
                        <div
                          key={song.id}
                          onClick={() => handleSelectFromSearch(song)}
                          className="p-3 hover:bg-slate-800/80 cursor-pointer transition flex items-center justify-between gap-2 text-left group"
                        >
                          <div className="min-w-0 flex-1">
                            <h4 className="text-xs sm:text-sm font-bold font-telugu text-white group-hover:text-amber-300 transition truncate">
                              {song.t}
                            </h4>
                            {song.tr && song.tr !== song.t && (
                              <p className="text-[11px] text-slate-400 truncate mt-0.5">
                                {song.tr}
                              </p>
                            )}
                            <div className="flex items-center gap-1.5 mt-1">
                              <span className="text-[9px] uppercase font-bold px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 border border-slate-700">
                                {song.lang}
                              </span>
                              {song.chords && (
                                <span className="text-[9px] font-semibold text-amber-400 flex items-center gap-0.5">
                                  <Guitar className="w-2.5 h-2.5" /> Chords
                                </span>
                              )}
                              {song.video && (
                                <span className="text-[9px] font-semibold text-rose-400 flex items-center gap-0.5">
                                  <Video className="w-2.5 h-2.5" /> Media
                                </span>
                              )}
                            </div>
                          </div>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-amber-400 group-hover:translate-x-0.5 transition shrink-0" />
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Right Action Icons: Mobile Search Trigger, Dark Mode, Language, Mobile Hamburger */}
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                
                {/* Mobile Search Trigger Button (visible only on small screens) */}
                <button
                  onClick={handleOpenSearch}
                  className="md:hidden w-9 h-9 rounded-full bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-slate-300 hover:text-amber-300 flex items-center justify-center transition shadow-sm"
                  title="Search songs"
                >
                  <Search className="w-4 h-4" />
                </button>

                {/* Dark / Light Toggle */}
                <button
                  onClick={() => setDarkMode(!darkMode)}
                  className="w-8.5 h-8.5 sm:w-9 sm:h-9 rounded-full bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-amber-400 hover:text-amber-300 flex items-center justify-center transition shadow-sm"
                  title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
                >
                  {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                </button>

                {/* Language Switcher Pill */}
                <div className="flex items-center rounded-full bg-slate-900 border border-slate-700/80 p-0.5 shadow-sm text-xs font-semibold">
                  <button
                    onClick={() => setLanguage('all')}
                    className={`px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[11px] sm:text-xs transition ${
                      language === 'all'
                        ? 'bg-amber-500 text-slate-950 font-bold'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setLanguage('telugu')}
                    className={`px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-full text-[11px] sm:text-xs font-telugu transition ${
                      language === 'telugu'
                        ? 'bg-amber-500 text-slate-950 font-bold'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    తె
                  </button>
                  <button
                    onClick={() => setLanguage('english')}
                    className={`px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-full text-[11px] sm:text-xs transition ${
                      language === 'english'
                        ? 'bg-amber-500 text-slate-950 font-bold'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    EN
                  </button>
                </div>

                {/* Mobile Menu Hamburger */}
                <button
                  onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                  className="lg:hidden p-2 rounded-xl text-slate-300 hover:bg-slate-800 transition"
                  title="Menu"
                >
                  <Menu className="w-5 h-5" />
                </button>
              </div>
            </>
          )}

        </div>

        {/* Mobile Navigation Drawer */}
        {isMobileMenuOpen && !isMobileSearchOpen && (
          <div className="lg:hidden py-3 border-t border-slate-800 flex flex-col gap-2">
            <button
              onClick={() => {
                setIsMobileMenuOpen(false);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="px-3 py-2 rounded-lg text-sm text-left font-medium text-slate-200 hover:bg-slate-800"
            >
              Home
            </button>
            <button
              onClick={() => scrollToSection('songs-catalog')}
              className="px-3 py-2 rounded-lg text-sm text-left font-medium text-slate-200 hover:bg-slate-800"
            >
              All Songs ({totalCount})
            </button>
            <button
              onClick={() => scrollToSection('categories-section')}
              className="px-3 py-2 rounded-lg text-sm text-left font-medium text-slate-200 hover:bg-slate-800"
            >
              Categories
            </button>
            {/* Watch YouTube Videos link commented out, can be enabled anytime:
            <button
              onClick={() => scrollToSection('youtube')}
              className="px-3 py-2 rounded-lg text-sm text-left font-medium text-rose-300 hover:bg-slate-800 flex items-center gap-2"
            >
              <Video className="w-4 h-4 text-rose-400" />
              <span>Watch YouTube Videos</span>
            </button>
            */}
            {isFeatureEnabled('personal_favorites') && (
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  onOpenFavorites();
                }}
                className="px-3 py-2 rounded-lg text-sm text-left font-medium text-slate-200 hover:bg-slate-800 flex items-center justify-between"
              >
                <span className="flex items-center gap-2">
                  <Heart className="w-4 h-4 text-rose-400 fill-rose-400" /> Favorites
                </span>
                <span className="text-xs bg-rose-500/20 text-rose-300 px-2 py-0.5 rounded-full">
                  {favoritesCount}
                </span>
              </button>
            )}
            <button
              onClick={() => {
                setIsMobileMenuOpen(false);
                onOpenAbout();
              }}
              className="px-3 py-2 rounded-lg text-sm text-left font-medium text-slate-200 hover:bg-slate-800"
            >
              About & Fellowship
            </button>
            <button
              onClick={() => {
                setIsMobileMenuOpen(false);
                onOpenAdmin();
              }}
              className={`px-3 py-2 rounded-lg text-sm text-left font-medium flex items-center justify-between transition ${
                isAdmin ? 'text-amber-300 bg-amber-500/15' : 'text-slate-200 hover:bg-slate-800'
              }`}
            >
              <span className="flex items-center gap-2">
                {isAdmin ? <ShieldCheck className="w-4 h-4 text-amber-400" /> : <Lock className="w-4 h-4 text-slate-400" />}
                <span>Admin Portal</span>
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                {isAdmin ? 'Signed In' : 'Sign In'}
              </span>
            </button>
          </div>
        )}

      </div>
    </header>
  );
}
