import React, { useState, useRef, useEffect } from 'react';
import { Search, X, Moon, Sun, Heart, Menu, ArrowLeft, ArrowRight, Guitar, Video, BookOpen, Globe } from 'lucide-react';

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
  quickResults = [],
  onSelectSong,
  favoritesCount = 0,
  onOpenFavorites,
  onOpenAbout
}) {
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const searchInputRef = useRef(null);
  const searchContainerRef = useRef(null);

  // Auto focus input when mobile search opens
  useEffect(() => {
    if (isMobileSearchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isMobileSearchOpen]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
    <header className="sticky top-0 z-40 bg-slate-950/90 dark:bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80 transition-colors shadow-lg">
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
                  placeholder="Search 3,773 songs by Telugu or English..."
                  className="w-full pl-10 pr-9 py-2.5 text-sm bg-slate-900 border border-slate-700 rounded-full text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400/50 shadow-inner"
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

                {/* Instant Live Search Results Dropdown */}
                {isDropdownOpen && searchQuery.trim().length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900 rounded-2xl shadow-2xl border border-slate-700 overflow-hidden z-50 max-h-[75vh] overflow-y-auto">
                    <div className="p-2.5 bg-slate-800/80 border-b border-slate-700 flex items-center justify-between text-xs text-slate-300">
                      <span>Found <strong>{filteredCount}</strong> songs</span>
                      <span>Tap to open details</span>
                    </div>

                    {quickResults.length === 0 ? (
                      <div className="p-6 text-center text-sm text-slate-400">
                        No matching songs for "{searchQuery}"
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-800">
                        {quickResults.slice(0, 10).map((song) => (
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
                                <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
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
              <nav className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/80 border border-slate-800 shadow-inner">
                <button
                  onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                  className="px-4 py-1.5 rounded-full text-xs font-semibold text-white bg-slate-800 shadow-sm transition"
                >
                  Home
                </button>
                <button
                  onClick={() => scrollToSection('songs-catalog')}
                  className="px-4 py-1.5 rounded-full text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800/60 transition"
                >
                  Songs
                </button>
                <button
                  onClick={() => scrollToSection('categories-section')}
                  className="px-4 py-1.5 rounded-full text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800/60 transition"
                >
                  Categories
                </button>
                <button
                  onClick={onOpenFavorites}
                  className="px-3.5 py-1.5 rounded-full text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800/60 transition flex items-center gap-1.5"
                >
                  <Heart className="w-3.5 h-3.5 text-rose-400 fill-rose-400" />
                  <span>Favorites</span>
                  {favoritesCount > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                      {favoritesCount}
                    </span>
                  )}
                </button>
                <button
                  onClick={onOpenAbout}
                  className="px-4 py-1.5 rounded-full text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800/60 transition"
                >
                  About
                </button>
              </nav>

              {/* Right Action Icons: Search, Dark Mode, Language */}
              <div className="flex items-center gap-2 sm:gap-2.5">
                
                {/* Search Trigger Button */}
                <button
                  onClick={handleOpenSearch}
                  className="w-9 h-9 rounded-full bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-slate-300 hover:text-amber-300 flex items-center justify-center transition shadow-sm"
                  title="Search songs"
                >
                  <Search className="w-4 h-4" />
                </button>

                {/* Dark / Light Toggle */}
                <button
                  onClick={() => setDarkMode(!darkMode)}
                  className="w-9 h-9 rounded-full bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-amber-400 hover:text-amber-300 flex items-center justify-center transition shadow-sm"
                  title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
                >
                  {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                </button>

                {/* Language Switcher Pill */}
                <div className="flex items-center rounded-full bg-slate-900 border border-slate-700/80 p-0.5 shadow-sm text-xs font-semibold">
                  <button
                    onClick={() => setLanguage('all')}
                    className={`px-2.5 py-1 rounded-full transition ${
                      language === 'all'
                        ? 'bg-amber-500 text-slate-950 font-bold'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setLanguage('telugu')}
                    className={`px-2 py-1 rounded-full font-telugu transition ${
                      language === 'telugu'
                        ? 'bg-amber-500 text-slate-950 font-bold'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    తె
                  </button>
                  <button
                    onClick={() => setLanguage('english')}
                    className={`px-2 py-1 rounded-full transition ${
                      language === 'english'
                        ? 'bg-amber-500 text-slate-950 font-bold'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    EN
                  </button>
                </div>

                {/* Mobile Menu Hamburger Button */}
                <button
                  onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                  className="md:hidden w-9 h-9 rounded-full bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition"
                  title="Menu"
                >
                  <Menu className="w-4 h-4" />
                </button>

              </div>
            </>
          )}

        </div>

        {/* Mobile Navigation Drawer */}
        {isMobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-slate-800 space-y-2">
            <button
              onClick={() => { setIsMobileMenuOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              className="w-full text-left px-4 py-2.5 rounded-xl text-sm font-semibold text-white hover:bg-slate-800 transition"
            >
              Home
            </button>
            <button
              onClick={() => scrollToSection('songs-catalog')}
              className="w-full text-left px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-300 hover:bg-slate-800 transition"
            >
              Songs Catalog (3,773)
            </button>
            <button
              onClick={() => scrollToSection('categories-section')}
              className="w-full text-left px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-300 hover:bg-slate-800 transition"
            >
              Browse Categories
            </button>
            <button
              onClick={() => { setIsMobileMenuOpen(false); if (onOpenSongbooks) onOpenSongbooks(); }}
              className="w-full text-left px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-300 hover:bg-slate-800 transition flex items-center gap-2"
            >
              <BookOpen className="w-4 h-4 text-amber-400" />
              <span>Official Hymnal Songbooks (8)</span>
            </button>
            <button
              onClick={() => { setIsMobileMenuOpen(false); if (onOpenFavorites) onOpenFavorites(); }}
              className="w-full text-left px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-300 hover:bg-slate-800 transition flex items-center justify-between"
            >
              <span className="flex items-center gap-2">
                <Heart className="w-4 h-4 text-rose-400 fill-rose-400" />
                <span>My Favorites</span>
              </span>
              {favoritesCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  {favoritesCount}
                </span>
              )}
            </button>
            <button
              onClick={() => { setIsMobileMenuOpen(false); if (onOpenAbout) onOpenAbout(); }}
              className="w-full text-left px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-300 hover:bg-slate-800 transition"
            >
              About Jesus Heals Fellowship
            </button>
          </div>
        )}

      </div>
    </header>
  );
}
