import React, { useState, useRef, useEffect } from 'react';
import { Search, X, Moon, Sun, Music2, BookOpen, Guitar, Video, FileText, ArrowLeft, ChevronRight } from 'lucide-react';

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
  onSelectSong
}) {
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
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

  return (
    <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors shadow-sm">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        
        {/* Main Header Bar */}
        <div className="flex items-center justify-between h-16 gap-2 sm:gap-4">
          
          {/* Mobile Full-Width Search Mode */}
          {isMobileSearchOpen ? (
            <div className="flex items-center w-full gap-2 py-2" ref={searchContainerRef}>
              {/* Back / Collapse Button */}
              <button
                onClick={handleCloseSearch}
                className="p-2 -ml-1 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition shrink-0"
                title="Back to menu"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>

              {/* Extended Search Input */}
              <div className="flex-1 relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-500" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setIsDropdownOpen(true);
                  }}
                  onFocus={() => setIsDropdownOpen(true)}
                  placeholder="Type song title in Telugu or English..."
                  className="w-full pl-10 pr-9 py-2.5 text-sm bg-slate-100 dark:bg-slate-800 rounded-full text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 shadow-inner"
                />
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      if (searchInputRef.current) searchInputRef.current.focus();
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}

                {/* Instant Mobile Live Search Results Dropdown */}
                {isDropdownOpen && searchQuery.trim().length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden z-50 max-h-[75vh] overflow-y-auto">
                    <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
                      <span>Found <strong>{filteredCount}</strong> songs</span>
                      <span>Tap to open details</span>
                    </div>

                    {quickResults.length === 0 ? (
                      <div className="p-6 text-center text-sm text-slate-400">
                        No matching songs for "{searchQuery}"
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
                        {quickResults.slice(0, 10).map((song) => (
                          <div
                            key={song.id}
                            onClick={() => handleSelectFromSearch(song)}
                            className="p-3.5 hover:bg-brand-50/70 dark:hover:bg-brand-950/40 cursor-pointer transition flex items-center justify-between gap-3 text-left"
                          >
                            <div className="min-w-0 flex-1">
                              <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                                {song.t}
                              </h4>
                              {song.tr && song.tr !== song.t && (
                                <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                                  {song.tr}
                                </p>
                              )}
                              <div className="flex items-center gap-1.5 mt-1">
                                <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                  {song.lang}
                                </span>
                                {song.chords && (
                                  <span className="text-[10px] font-semibold text-amber-500 flex items-center gap-0.5">
                                    <Guitar className="w-2.5 h-2.5" /> Chords
                                  </span>
                                )}
                                {song.video && (
                                  <span className="text-[10px] font-semibold text-rose-500 flex items-center gap-0.5">
                                    <Video className="w-2.5 h-2.5" /> Media
                                  </span>
                                )}
                              </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Normal Header Mode */
            <>
              {/* Logo & Title */}
              <div 
                className="flex items-center gap-2 sm:gap-3 shrink-0 cursor-pointer min-w-0" 
                onClick={() => { setSearchQuery(''); setFilterType('all'); setLanguage('all'); }}
              >
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-brand-500/20 shrink-0">
                  <Music2 className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-sm sm:text-base md:text-lg font-bold tracking-tight text-slate-900 dark:text-white leading-tight font-telugu truncate">
                    సార్వత్రిక క్రైస్తవ కీర్తనలు
                  </h1>
                  <span className="text-[10px] sm:text-[11px] font-semibold text-brand-600 dark:text-brand-400 tracking-wide block truncate">
                    All Christian Songs
                  </span>
                </div>
              </div>

              {/* Desktop Center: Search Bar with Live Dropdown */}
              <div className="hidden sm:block flex-1 max-w-xl relative" ref={searchContainerRef}>
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setIsDropdownOpen(true);
                    }}
                    onFocus={() => setIsDropdownOpen(true)}
                    placeholder="Search 3,773 songs by Telugu, English or Lyric..."
                    className="w-full pl-10 pr-10 py-2 text-sm bg-slate-100 dark:bg-slate-800 border-none rounded-full text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Desktop Live Search Results Dropdown */}
                {isDropdownOpen && searchQuery.trim().length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden z-50 max-h-96 overflow-y-auto">
                    <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
                      <span>Found <strong>{filteredCount}</strong> songs</span>
                      <span>Click to view details</span>
                    </div>
                    {quickResults.slice(0, 8).map((song) => (
                      <div
                        key={song.id}
                        onClick={() => handleSelectFromSearch(song)}
                        className="p-3 hover:bg-brand-50/70 dark:hover:bg-brand-950/40 cursor-pointer transition flex items-center justify-between gap-3 text-left border-b border-slate-100/70 dark:border-slate-800/50"
                      >
                        <div className="min-w-0 flex-1">
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                            {song.t}
                          </h4>
                          {song.tr && song.tr !== song.t && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                              {song.tr}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {song.chords && (
                            <span className="text-[10px] font-semibold text-amber-500 flex items-center gap-0.5 bg-amber-50 dark:bg-amber-950/50 px-1.5 py-0.5 rounded">
                              <Guitar className="w-3 h-3" /> Chords
                            </span>
                          )}
                          <ChevronRight className="w-4 h-4 text-slate-400" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Right Controls */}
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                {/* Mobile Search Button (Expands Search Bar Full Width) */}
                <button
                  onClick={handleOpenSearch}
                  className="sm:hidden p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
                  title="Search songs"
                >
                  <Search className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                </button>

                {/* Songbooks Button */}
                <button
                  onClick={onOpenSongbooks}
                  className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-medium rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition"
                  title="Browse Songbooks"
                >
                  <BookOpen className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
                  <span className="hidden md:inline">Songbooks</span>
                </button>

                {/* Dark Mode Toggle */}
                <button
                  onClick={() => setDarkMode(!darkMode)}
                  className="p-2 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
                >
                  {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                </button>
              </div>
            </>
          )}

        </div>

        {/* Secondary Navigation: Language & Feature Filter Bar */}
        <div className="flex items-center justify-between overflow-x-auto py-2.5 gap-2 sm:gap-4 no-scrollbar border-t border-slate-100 dark:border-slate-800/60 text-xs">
          {/* Languages */}
          <div className="flex items-center gap-1 shrink-0">
            {[
              { id: 'all', label: 'All' },
              { id: 'telugu', label: 'తెలుగు' },
              { id: 'english', label: 'English' },
              { id: 'hindi', label: 'हिंदी' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setLanguage(tab.id)}
                className={`px-3 py-1 rounded-full font-medium transition ${
                  language === tab.id
                    ? 'bg-brand-600 text-white shadow-sm font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Feature Filters */}
          <div className="flex items-center gap-1 shrink-0">
            {[
              { id: 'all', label: 'All Songs', icon: null },
              { id: 'chords', label: 'Chords (148)', icon: Guitar, color: 'text-amber-500' },
              { id: 'video', label: 'Media (2,426)', icon: Video, color: 'text-rose-500' },
              { id: 'ppt', label: 'PPT', icon: FileText, color: 'text-emerald-500' },
            ].map(f => {
              const Icon = f.icon;
              return (
                <button
                  key={f.id}
                  onClick={() => setFilterType(f.id)}
                  className={`flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-full font-medium transition ${
                    filterType === f.id
                      ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 font-semibold'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/60 dark:border-slate-800'
                  }`}
                >
                  {Icon && <Icon className={`w-3.5 h-3.5 ${f.color}`} />}
                  <span>{f.label}</span>
                </button>
              );
            })}
          </div>

        </div>
      </div>
    </header>
  );
}
