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
import { filterSongs } from './utils/search';

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
  
  // Favorites stored in localStorage
  const [favorites, setFavorites] = useState(() => {
    try {
      const saved = localStorage.getItem('jhf_favorites');
      return saved ? JSON.parse(saved) : [];
    } catch (_) {
      return [];
    }
  });

  // Active modal / detail states
  const [selectedSong, setSelectedSong] = useState(null);
  const [activeMedia, setActiveMedia] = useState(null);
  const [presentationSong, setPresentationSong] = useState(null);
  const [isSongbooksOpen, setIsSongbooksOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [isFavoritesOpen, setIsFavoritesOpen] = useState(false);
  
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

  // Persist favorites to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('jhf_favorites', JSON.stringify(favorites));
    } catch (_) {}
  }, [favorites]);

  const toggleFavorite = (songId) => {
    setFavorites((prev) =>
      prev.includes(songId) ? prev.filter((id) => id !== songId) : [...prev, songId]
    );
  };

  // Load compact index once on boot
  useEffect(() => {
    fetch('./data/compact_index.json')
      .then((res) => res.json())
      .then((data) => {
        const loaded = data || [];
        // By default display Telugu songs starting
        const sorted = [...loaded].sort((a, b) => {
          const aTe = a.lang === 'telugu' ? 1 : 0;
          const bTe = b.lang === 'telugu' ? 1 : 0;
          return bTe - aTe;
        });
        setSongs(sorted);
        setLoading(false);
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

  const handleOpenSong = (song) => {
    setSelectedSong(song);
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

  const handleSelectSongbook = (book) => {
    setActiveSongbook(book);
    setFilterType('all');
    setSearchQuery('');
    setAlphabet(null);
    setCategory(null);
    const el = document.getElementById('songs-catalog');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
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
                  onClose={() => setSelectedSong(null)}
                  onPlayMedia={(song) => setActiveMedia(song)}
                  activePlayingId={activeMedia?.id}
                  onOpenPresentation={(song) => setPresentationSong(song)}
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
      <PresentationModal
        song={presentationSong}
        isOpen={!!presentationSong}
        onClose={() => setPresentationSong(null)}
      />

      {/* About Modal */}
      <AboutModal
        isOpen={isAboutOpen}
        onClose={() => setIsAboutOpen(false)}
      />

      {/* Favorites Modal */}
      <FavoritesModal
        isOpen={isFavoritesOpen}
        onClose={() => setIsFavoritesOpen(false)}
        favorites={favorites}
        allSongs={songs}
        onSelectSong={handleOpenSong}
        onRemoveFavorite={toggleFavorite}
      />

    </div>
  );
}
