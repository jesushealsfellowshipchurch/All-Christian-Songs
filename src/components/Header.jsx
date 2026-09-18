import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, X, Moon, Sun, Heart, Menu, ArrowLeft, ArrowRight, Guitar, Video, BookOpen, Globe, Music, Lock, Plus, ShieldCheck, Church, LogIn, LogOut, User, UserPlus, ChevronDown } from 'lucide-react';
import { getSongSuggestions } from '../utils/search';
import { useFeatures } from '../context/FeatureContext';
import { useAuth } from '../context/AuthContext';

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
  onOpenAdmin,
  onOpenMyChurches,
  onChurchNavClick,
  churchNavLabel,
  myChurchesCount = 0,
  onOpenAuth
}) {
  const { isFeatureEnabled } = useFeatures();
  const { user, profile, signOut } = useAuth();
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const handleChurchClick = onChurchNavClick || onOpenMyChurches;
  const effectiveChurchLabel = churchNavLabel || (myChurchesCount === 0 ? 'Join a Church' : myChurchesCount === 1 ? 'My Church' : 'My Churches');

  const searchInputRef = useRef(null);
  const desktopSearchInputRef = useRef(null);
  const searchContainerRef = useRef(null);
  const desktopSearchContainerRef = useRef(null);
  const userMenuRef = useRef(null);

  // Auto focus input when mobile search opens
  useEffect(() => {
    if (isMobileSearchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isMobileSearchOpen]);

  // Close search suggestions dropdown on click outside
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
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Compute clean user display name and initials
  const displayName = useMemo(() => {
    if (profile?.full_name?.trim()) {
      return profile.full_name.trim().split(/\s+/)[0];
    }
    if (user?.email) {
      return user.email.split('@')[0];
    }
    return 'Member';
  }, [profile?.full_name, user?.email]);

  const userInitials = useMemo(() => {
    if (profile?.full_name?.trim()) {
      const parts = profile.full_name.trim().split(/\s+/);
      if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      if (parts[0]) return parts[0].slice(0, 2).toUpperCase();
    }
    if (user?.email) {
      return user.email.slice(0, 2).toUpperCase();
    }
    return 'U';
  }, [profile?.full_name, user?.email]);

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
                {Boolean(user && isFeatureEnabled('church_workspaces')) && (
                  <button
                    onClick={handleChurchClick}
                    className="px-2.5 xl:px-3 py-1.5 rounded-full text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800/60 transition flex items-center gap-1.5"
                    title={effectiveChurchLabel}
                  >
                    <Church className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span className="whitespace-nowrap">{effectiveChurchLabel}</span>
                    {myChurchesCount > 1 && (
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        {myChurchesCount}
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
                {isAdmin && (
                  <button
                    onClick={onOpenAdmin}
                    className="px-2.5 xl:px-3.5 py-1.5 rounded-full text-xs font-semibold transition flex items-center gap-1.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30"
                    title="Admin Portal"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                    <span>Admin</span>
                  </button>
                )}
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

                {/* User Account / Sign In Control */}
                {user ? (
                  <div className="relative" ref={userMenuRef}>
                    <button
                      type="button"
                      onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                      className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-full bg-slate-900 border border-slate-700/80 hover:border-amber-400/50 text-slate-200 hover:text-white transition text-xs font-medium shadow-sm"
                      title="User Account Menu"
                      aria-expanded={isUserMenuOpen}
                    >
                      <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-amber-500 to-amber-600 text-slate-950 flex items-center justify-center font-bold text-[10px] shadow-sm shrink-0">
                        {userInitials}
                      </div>
                      <span className="hidden md:inline max-w-[80px] truncate text-[11px] font-semibold text-slate-200">
                        {displayName}
                      </span>
                      <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${isUserMenuOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Dropdown Menu */}
                    {isUserMenuOpen && (
                      <div className="absolute right-0 mt-2 w-56 bg-slate-900/95 border border-slate-700/90 rounded-2xl shadow-2xl overflow-hidden z-50 backdrop-blur-xl py-1 text-xs divide-y divide-slate-800 animate-fadeIn">
                        <div className="px-3.5 py-2.5 bg-slate-800/40">
                          <p className="font-bold text-white text-xs truncate">
                            {profile?.full_name || 'Member'}
                          </p>
                          <p className="text-[10px] text-slate-400 truncate mt-0.5 font-mono">
                            {user.email}
                          </p>
                          <div className="mt-1.5">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wider ${
                              profile?.role === 'admin'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            }`}>
                              {profile?.role === 'admin' ? 'Super Admin' : 'Member'}
                            </span>
                          </div>
                        </div>

                        <div className="py-1">
                          {isFeatureEnabled('personal_favorites') && (
                            <button
                              type="button"
                              onClick={() => {
                                setIsUserMenuOpen(false);
                                onOpenFavorites();
                              }}
                              className="w-full px-3.5 py-2 text-left text-slate-300 hover:text-white hover:bg-slate-800/80 transition flex items-center justify-between"
                            >
                              <span className="flex items-center gap-2">
                                <Heart className="w-3.5 h-3.5 text-rose-400 fill-rose-400" />
                                <span>My Favorites</span>
                              </span>
                              {favoritesCount > 0 && (
                                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-500/20 text-rose-300">
                                  {favoritesCount}
                                </span>
                              )}
                            </button>
                          )}

                          {isFeatureEnabled('church_workspaces') && (
                            <button
                              type="button"
                              onClick={() => {
                                setIsUserMenuOpen(false);
                                if (handleChurchClick) handleChurchClick();
                              }}
                              className="w-full px-3.5 py-2 text-left text-slate-300 hover:text-white hover:bg-slate-800/80 transition flex items-center justify-between"
                            >
                              <span className="flex items-center gap-2">
                                <Church className="w-3.5 h-3.5 text-amber-400" />
                                <span>{effectiveChurchLabel}</span>
                              </span>
                              {myChurchesCount > 1 && (
                                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500/20 text-amber-300 font-bold">
                                  {myChurchesCount}
                                </span>
                              )}
                            </button>
                          )}

                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => {
                                setIsUserMenuOpen(false);
                                onOpenAdmin();
                              }}
                              className="w-full px-3.5 py-2 text-left text-amber-300 hover:text-amber-200 hover:bg-amber-500/10 transition flex items-center gap-2"
                            >
                              <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                              <span>Admin Portal</span>
                            </button>
                          )}
                        </div>

                        <div className="py-1">
                          <button
                            type="button"
                            onClick={() => {
                              setIsUserMenuOpen(false);
                              signOut();
                            }}
                            className="w-full px-3.5 py-2 text-left text-rose-300 hover:text-rose-200 hover:bg-rose-500/10 transition flex items-center gap-2"
                          >
                            <LogOut className="w-3.5 h-3.5" />
                            <span>Sign Out</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onOpenAuth && onOpenAuth('login')}
                      className="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs font-semibold text-slate-200 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-700/80 transition flex items-center gap-1.5 shadow-sm"
                      title="Sign In"
                    >
                      <LogIn className="w-3.5 h-3.5 text-amber-400" />
                      <span>Sign In</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenAuth && onOpenAuth('signup')}
                      className="hidden sm:inline-flex items-center gap-1 px-3 py-1 sm:py-1.5 rounded-full text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 transition shadow-sm"
                      title="Sign Up"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Sign Up</span>
                    </button>
                  </div>
                )}

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
            {/* User / Guest Status Card */}
            {user ? (
              <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl mb-1 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">
                    {userInitials}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate">
                      {profile?.full_name || 'Member'}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate font-mono">
                      {user.email}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    signOut();
                  }}
                  className="p-2 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition shrink-0"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl mb-1 flex flex-col gap-2">
                <p className="text-[11px] text-slate-300 font-medium">Sign in to save favorites and access church workspaces</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      if (onOpenAuth) onOpenAuth('login');
                    }}
                    className="w-full py-2 px-3 rounded-lg text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 flex items-center justify-center gap-1.5 transition shadow-sm"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    <span>Sign In</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      if (onOpenAuth) onOpenAuth('signup');
                    }}
                    className="w-full py-2 px-3 rounded-lg text-xs font-semibold text-amber-300 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 flex items-center justify-center gap-1.5 transition"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Sign Up</span>
                  </button>
                </div>
              </div>
            )}
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
            {Boolean(user && isFeatureEnabled('church_workspaces')) && (
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  if (handleChurchClick) handleChurchClick();
                }}
                className="px-3 py-2 rounded-lg text-sm text-left font-medium text-slate-200 hover:bg-slate-800 flex items-center justify-between"
              >
                <span className="flex items-center gap-2">
                  <Church className="w-4 h-4 text-amber-400" />
                  <span>{effectiveChurchLabel}</span>
                </span>
                {myChurchesCount > 1 && (
                  <span className="text-xs bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full font-bold">
                    {myChurchesCount}
                  </span>
                )}
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
            {isAdmin && (
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  onOpenAdmin();
                }}
                className="px-3 py-2 rounded-lg text-sm text-left font-medium flex items-center justify-between transition text-amber-300 bg-amber-500/15"
              >
                <span className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-amber-400" />
                  <span>Admin Portal</span>
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                  Signed In
                </span>
              </button>
            )}
          </div>
        )}

      </div>
    </header>
  );
}
