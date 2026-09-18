import React, { useState, useEffect, useMemo } from 'react';
import Header from './components/Header';
import HeroSection from './components/HeroSection';
import CategoryHeroCards from './components/CategoryHeroCards';
import YouTubeSection from './components/YouTubeSection';
import SongList from './components/SongList';
import SongDetail from './components/SongDetail';
import InfoSection from './components/InfoSection';
import Footer from './components/Footer';
import MediaPlayer from './components/MediaPlayer';
import SongbooksModal from './components/SongbooksModal';
import PresentationModal from './components/PresentationModal';
import AboutModal from './components/AboutModal';
import FavoritesModal from './components/FavoritesModal';
import UserAuthModal from './components/UserAuthModal';
import AdminLoginModal from './components/AdminLoginModal';
import AdminPortalModal from './components/admin/AdminPortalModal';
import ChurchWorkspaceModal from './components/church/ChurchWorkspaceModal';
import MyChurchesModal from './components/church/MyChurchesModal';
import PinnedSongsSection from './components/PinnedSongsSection';
import { filterSongs } from './utils/search';
import { fetchPinnedSongs } from './utils/pinManager';
import { getCatalogIndex } from './services/catalogRepository';
import { useAuth } from './context/AuthContext';
import { useFeatures } from './context/FeatureContext';
import { useChurch } from './context/ChurchContext';
import {
  getLocalFavorites,
  setLocalFavorites,
  fetchUserFavorites,
  addUserFavorite,
  removeUserFavorite,
  syncLocalFavoritesToCloud
} from './services/favoritesService';

export default function App() {
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [language, setLanguage] = useState('all');
  const [filterType, setFilterType] = useState('all'); // 'all' | 'chords' | 'video' | 'ppt'
  const [alphabet, setAlphabet] = useState(null);
  const [category, setCategory] = useState(null);
  const [activeSongbook, setActiveSongbook] = useState(null);
  
  // Active modal / detail states
  const [selectedSong, setSelectedSong] = useState(null);
  const [activeMedia, setActiveMedia] = useState(null);
  const [presentationSong, setPresentationSong] = useState(null);
  const [isSongbooksOpen, setIsSongbooksOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [isFavoritesOpen, setIsFavoritesOpen] = useState(false);
  
  // Auth state derived securely from Supabase AuthContext
  const { user, profile } = useAuth();
  const isAdmin = Boolean(user && profile?.role === 'admin');
  const { isFeatureEnabled } = useFeatures();
  const { myChurches, activeChurches, churchNavLabel, selectChurch } = useChurch();
  const [isAdminLoginOpen, setIsAdminLoginOpen] = useState(false);
  const [isAdminPortalOpen, setIsAdminPortalOpen] = useState(false);
  const [isMyChurchesOpen, setIsMyChurchesOpen] = useState(false);
  const [myChurchesModalTab, setMyChurchesModalTab] = useState('list');
  const [isChurchWorkspaceOpen, setIsChurchWorkspaceOpen] = useState(false);
  const [isUserAuthOpen, setIsUserAuthOpen] = useState(false);
  const [userAuthMode, setUserAuthMode] = useState('login');

  const handleOpenUserAuth = (mode = 'login') => {
    setUserAuthMode(mode);
    setIsUserAuthOpen(true);
  };

  const handleChurchNavClick = () => {
    if (!user) {
      handleOpenUserAuth('login');
      return;
    }

    const churchList = activeChurches && activeChurches.length >= 0 ? activeChurches : (myChurches || []);

    if (churchList.length === 0) {
      // 1. User belongs to ZERO churches:
      // Show "Join a Church" -> clicking opens join modal directly
      setMyChurchesModalTab('join');
      setIsMyChurchesOpen(true);
    } else if (churchList.length === 1) {
      // 2. User belongs to EXACTLY ONE church:
      // Show "My Church" -> clicking opens that church workspace directly without church-selection screen!
      selectChurch(churchList[0].id);
      setIsChurchWorkspaceOpen(true);
    } else {
      // 3. User belongs to MORE THAN ONE church:
      // Show "My Churches" -> clicking opens church selector list
      setMyChurchesModalTab('list');
      setIsMyChurchesOpen(true);
    }
  };

  // Favorites: Cloud-synced for authenticated users, localStorage for guests
  const [favorites, setFavorites] = useState(() => getLocalFavorites());

  // Synchronize favorites on auth state transitions (login, logout, restoration)
  useEffect(() => {
    let isCancelled = false;

    async function syncFavorites() {
      if (user?.id) {
        // 1. Authenticated user: load cloud favorites
        const cloudResult = await fetchUserFavorites(user.id);
        if (isCancelled) return;

        let activeIds = cloudResult.success ? cloudResult.data : [];

        // 2. Safely detect and migrate any existing local guest favorites
        const local = getLocalFavorites();
        if (local.length > 0) {
          const catalogIds = songs && songs.length > 0 ? new Set(songs.map(s => s.id)) : null;
          const syncResult = await syncLocalFavoritesToCloud(user.id, local, catalogIds);
          if (syncResult.success && syncResult.migratedCount > 0) {
            activeIds = Array.from(new Set([...activeIds, ...local]));
          }
        }

        if (!isCancelled) {
          setFavorites(activeIds);
        }
      } else {
        // Guest user: load from localStorage
        const local = getLocalFavorites();
        if (!isCancelled) {
          setFavorites(local);
        }
      }
    }

    syncFavorites();

    return () => {
      isCancelled = true;
    };
  }, [user?.id, songs?.length]);

  // Persist favorites to localStorage ONLY in guest mode (unauthenticated)
  useEffect(() => {
    if (!user) {
      setLocalFavorites(favorites);
    }
  }, [favorites, user]);

  const toggleFavorite = async (songId) => {
    if (!songId) return;
    const isFav = favorites.includes(songId);

    // Optimistic UI update immediately
    const nextFavorites = isFav
      ? favorites.filter((id) => id !== songId)
      : [...favorites, songId];
    setFavorites(nextFavorites);

    if (user?.id) {
      if (isFav) {
        const { success } = await removeUserFavorite(user.id, songId);
        if (!success) {
          // Revert optimistic update on cloud failure
          setFavorites(favorites);
          console.warn('[Favorites] Failed to remove favorite in cloud');
        }
      } else {
        const { success } = await addUserFavorite(user.id, songId);
        if (!success) {
          // Revert optimistic update on cloud failure
          setFavorites(favorites);
          console.warn('[Favorites] Failed to add favorite in cloud');
        }
      }
    }
  };

  // Dark mode (default to true for rich stage aesthetic, can toggle)
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('theme') !== 'light';
  });

  // Apply dark mode class
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  // Load compact index and pinned songs once on boot
  useEffect(() => {
    fetchPinnedSongs();
    getCatalogIndex()
      .then(({ songs: loaded }) => {
        setSongs(loaded || []);
        setLoading(false);

        // Direct song URL resolution by slug or UUID (?song=... or ?id=... or ?slug=... or #slug)
        try {
          const searchParams = new URLSearchParams(window.location.search);
          const targetParam = searchParams.get('song') || searchParams.get('id') || searchParams.get('slug') || window.location.hash.replace(/^#/, '');
          if (targetParam && loaded && loaded.length > 0) {
            const cleanTarget = decodeURIComponent(targetParam).trim();
            const matched = loaded.find(s => s.slug === cleanTarget || s.id === cleanTarget);
            if (matched) {
              handleOpenSong(matched, false);
            }
          }
        } catch (_) {}
      })
      .catch((err) => {
        console.error("Error loading songs index:", err);
        setLoading(false);
      });
  }, []);

  // Filter songs memoized
  const filteredSongs = useMemo(() => {
    return filterSongs(songs, {
      query: searchQuery,
      language,
      filterType,
      songbook: activeSongbook?.slug,
      alphabet,
      category
    });
  }, [songs, searchQuery, language, filterType, activeSongbook, alphabet, category]);

  const handleOpenSong = (song, updateUrl = true) => {
    setSelectedSong(song);
    if (updateUrl && song) {
      try {
        const url = new URL(window.location.href);
        url.searchParams.set('song', song.slug || song.id);
        window.history.replaceState(null, '', url.toString());
      } catch (_) {}
    }
    // Smoothly scroll and redirect user focus to the song view
    setTimeout(() => {
      const detailEl =
        document.getElementById('song-detail-container') ||
        document.getElementById('song-detail-view') ||
        document.getElementById('songs-catalog');
      if (detailEl) {
        detailEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        detailEl.focus({ preventScroll: true });
      }
    }, 80);
  };

  const handleCloseSong = () => {
    setSelectedSong(null);
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('song');
      url.searchParams.delete('id');
      url.searchParams.delete('slug');
      const cleanUrl = url.pathname + (url.search ? url.search : '');
      window.history.replaceState(null, '', cleanUrl);
    } catch (_) {}
  };

  const handleSelectSongbook = (book) => {
    setActiveSongbook(book);
    setFilterType('all');
    setSearchQuery('');
    setAlphabet(null);
    setCategory(null);
    const el = document.getElementById('songs-catalog');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  const handleOpenAdmin = () => {
    if (isAdmin) {
      setIsAdminPortalOpen(true);
    } else {
      setIsAdminLoginOpen(true);
    }
  };

  const handleSongPublished = (newSong, indexEntry) => {
    // Immediately prepend to state
    setSongs((prev) => [indexEntry, ...prev.filter(s => s.id !== indexEntry.id && s.slug !== indexEntry.slug)]);
    // Select the song to open in SongDetail view
    setSelectedSong(indexEntry);
    setTimeout(() => {
      const detailEl =
        document.getElementById('song-detail-container') ||
        document.getElementById('song-detail-view') ||
        document.getElementById('songs-catalog');
      if (detailEl) {
        detailEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        detailEl.focus({ preventScroll: true });
      }
    }, 120);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 transition-colors selection:bg-amber-500 selection:text-slate-950">
      
      {/* Top Navbar with live suggested songs search */}
      <Header
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        language={language}
        setLanguage={setLanguage}
        filterType={filterType}
        setFilterType={setFilterType}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        totalCount={songs.length}
        filteredCount={filteredSongs.length}
        onOpenSongbooks={() => setIsSongbooksOpen(true)}
        songs={songs}
        onSelectSong={handleOpenSong}
        favoritesCount={favorites.length}
        onOpenFavorites={() => setIsFavoritesOpen(true)}
        onOpenAbout={() => setIsAboutOpen(true)}
        isAdmin={isAdmin}
        onOpenAdmin={handleOpenAdmin}
        onOpenMyChurches={handleChurchNavClick}
        onChurchNavClick={handleChurchNavClick}
        churchNavLabel={churchNavLabel}
        myChurchesCount={(activeChurches && activeChurches.length >= 0 ? activeChurches : (myChurches || [])).length}
        onOpenAuth={handleOpenUserAuth}
      />

      {/* Hero Section with Empty Tomb, Centered Telugu Title & Calligraphy, and Central Search with suggestions */}
      <HeroSection
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        songs={songs}
        onSelectSong={handleOpenSong}
        onSearchSubmit={() => {
          const el = document.getElementById('songs-catalog');
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        }}
        onSelectCategoryChip={(chip) => {
          if (chip.query === 'Christmas' || chip.query === 'Easter' || chip.query === 'Children') {
            setCategory(chip.query === 'Children' ? 'Sunday School' : chip.query);
          } else {
            setSearchQuery(chip.query);
          }
          const el = document.getElementById('songs-catalog');
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        }}
      />

      {/* 7 Category Cards Ribbon */}
      <CategoryHeroCards
        activeCategory={category}
        onSelectCategory={(catVal) => {
          setCategory(catVal);
          const el = document.getElementById('songs-catalog');
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        }}
      />

      {/* Pinned / Featured Songs for Today's Service */}
      {isFeatureEnabled('todays_service') && (
        <PinnedSongsSection
          onSelectSong={handleOpenSong}
          onQuickPlay={(song) => setActiveMedia(song)}
          isAdmin={isAdmin}
          allSongs={songs}
        />
      )}

      {/* YouTube Video Section (Watch With Us) - Currently commented out, can be re-enabled anytime */}
      {/* <YouTubeSection /> */}

      {/* Main Catalog & Song Detail Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-28 text-slate-400">
            <div className="w-11 h-11 border-3 border-amber-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-base font-semibold text-slate-200">
              Loading 3,773 Christian songs & chords...
            </p>
            <p className="text-xs text-slate-400 mt-1">Initializing instant search index</p>
          </div>
        ) : (
          <div className={`grid gap-6 ${selectedSong ? 'lg:grid-cols-12' : 'grid-cols-1'}`}>
            
            {/* Song List (Full Width or Left Column when Detail is Open) */}
            <div className={selectedSong ? 'lg:col-span-5 xl:col-span-5' : 'w-full'}>
              <SongList
                songs={filteredSongs}
                selectedSongId={selectedSong?.id}
                onSelectSong={handleOpenSong}
                onQuickPlay={(song) => setActiveMedia(song)}
                alphabet={alphabet}
                setAlphabet={setAlphabet}
                activeSongbook={activeSongbook}
                onClearSongbook={() => setActiveSongbook(null)}
                currentLanguage={language}
                activeCategory={category}
                onSelectCategory={setCategory}
                allSongs={songs}
                favorites={favorites}
                onToggleFavorite={toggleFavorite}
              />
            </div>

            {/* Song Detail Overlay / Right Column */}
            {selectedSong && (
              <div
                id="song-detail-container"
                tabIndex={-1}
                className="lg:col-span-7 xl:col-span-7 lg:sticky lg:top-24 lg:h-[calc(100vh-8rem)] fixed inset-0 z-[60] lg:z-30 bg-slate-950 p-0 overflow-hidden flex flex-col shadow-2xl rounded-none sm:rounded-2xl border-0 sm:border border-slate-800 outline-none"
              >
                <SongDetail
                  songSummary={selectedSong}
                  onClose={handleCloseSong}
                  onPlayMedia={(song) => setActiveMedia(song)}
                  activePlayingId={activeMedia?.id}
                  onOpenPresentation={(song) => setPresentationSong(song)}
                  favorites={favorites}
                  onToggleFavorite={toggleFavorite}
                />
              </div>
            )}

          </div>
        )}
      </main>

      {/* Info Section (Recent Updates, Scripture Quote with Gold Flourish, Why This Website) */}
      <InfoSection
        songs={songs}
        onSelectSong={handleOpenSong}
      />

      {/* Footer */}
      <Footer
        onOpenAbout={() => setIsAboutOpen(true)}
        onOpenContact={() => {
          alert("Contact Jesus Heals Fellowship:\nPhone: +91 94930 34647\nLocation: Ambati Satram Area, Vizianagaram, AP, India");
        }}
        onOpenAdmin={handleOpenAdmin}
      />

      {/* Floating Audio/Video Player Bar */}
      <MediaPlayer
        activeMedia={activeMedia}
        onClose={() => setActiveMedia(null)}
      />

      {/* Songbooks Modal */}
      <SongbooksModal
        isOpen={isSongbooksOpen}
        onClose={() => setIsSongbooksOpen(false)}
        onSelectSongbook={handleSelectSongbook}
      />

      {/* Church Projector Presentation Fullscreen Mode */}
      {isFeatureEnabled('presentation_mode') && (
        <PresentationModal
          song={presentationSong}
          isOpen={!!presentationSong}
          onClose={() => setPresentationSong(null)}
        />
      )}

      {/* About Modal */}
      <AboutModal
        isOpen={isAboutOpen}
        onClose={() => setIsAboutOpen(false)}
      />

      {/* Favorites Modal */}
      {isFeatureEnabled('personal_favorites') && (
        <FavoritesModal
          isOpen={isFavoritesOpen}
          onClose={() => setIsFavoritesOpen(false)}
          favorites={favorites}
          allSongs={songs}
          onSelectSong={handleOpenSong}
          onRemoveFavorite={toggleFavorite}
        />
      )}

      {/* User Authentication Modal (Sign In / Sign Up / Forgot Password) */}
      <UserAuthModal
        isOpen={isUserAuthOpen}
        initialMode={userAuthMode}
        onClose={() => setIsUserAuthOpen(false)}
        onOpenAdmin={() => {
          setIsUserAuthOpen(false);
          handleOpenAdmin();
        }}
      />

      {/* Admin Login Modal */}
      <AdminLoginModal
        isOpen={isAdminLoginOpen}
        onClose={() => setIsAdminLoginOpen(false)}
        onOpenPortal={() => {
          setIsAdminLoginOpen(false);
          setIsAdminPortalOpen(true);
        }}
      />

      {/* Admin Portal (Full-screen) */}
      <AdminPortalModal
        isOpen={isAdminPortalOpen}
        onClose={() => setIsAdminPortalOpen(false)}
      />

      {/* My Churches Modal */}
      {isFeatureEnabled('church_workspaces') && (
        <MyChurchesModal
          isOpen={isMyChurchesOpen}
          initialTab={myChurchesModalTab}
          onClose={() => setIsMyChurchesOpen(false)}
          onOpenWorkspace={() => {
            setIsMyChurchesOpen(false);
            setIsChurchWorkspaceOpen(true);
          }}
        />
      )}

      {/* Church Workspace Modal */}
      {isFeatureEnabled('church_workspaces') && (
        <ChurchWorkspaceModal
          isOpen={isChurchWorkspaceOpen}
          onClose={() => setIsChurchWorkspaceOpen(false)}
          onOpenMyChurches={() => {
            setIsChurchWorkspaceOpen(false);
            setMyChurchesModalTab('list');
            setIsMyChurchesOpen(true);
          }}
          onSelectSong={handleOpenSong}
        />
      )}

    </div>
  );
}
