import React, { useState, useEffect, useMemo } from 'react';
import Header from './components/Header';
import SongList from './components/SongList';
import SongDetail from './components/SongDetail';
import MediaPlayer from './components/MediaPlayer';
import SongbooksModal from './components/SongbooksModal';
import PresentationModal from './components/PresentationModal';
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
  
  // Active states
  const [selectedSong, setSelectedSong] = useState(null);
  const [activeMedia, setActiveMedia] = useState(null);
  const [presentationSong, setPresentationSong] = useState(null);
  const [isSongbooksOpen, setIsSongbooksOpen] = useState(false);
  
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

  // Load compact index once on boot
  useEffect(() => {
    fetch('./data/compact_index.json')
      .then(res => res.json())
      .then(data => {
        setSongs(data || []);
        setLoading(false);
      })
      .catch(err => {
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

  const handleSelectSongbook = (book) => {
    setActiveSongbook(book);
    setFilterType('all');
    setSearchQuery('');
    setAlphabet(null);
    setCategory(null);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      
      {/* Header */}
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
        quickResults={filteredSongs}
        onSelectSong={(song) => setSelectedSong(song)}
      />

      {/* Main Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 text-slate-400">
            <div className="w-10 h-10 border-3 border-brand-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-base font-semibold text-slate-700 dark:text-slate-300">
              Loading 3,773 songs & chords...
            </p>
            <p className="text-xs text-slate-400 mt-1">Initializing instant search index</p>
          </div>
        ) : (
          <div className={`grid gap-6 ${selectedSong ? 'lg:grid-cols-12' : 'grid-cols-1'}`}>
            
            {/* Song List (full width or left column) */}
            <div className={selectedSong ? 'lg:col-span-5 xl:col-span-5' : 'w-full'}>
              <SongList
                songs={filteredSongs}
                selectedSongId={selectedSong?.id}
                onSelectSong={(song) => setSelectedSong(song)}
                onQuickPlay={(song) => setActiveMedia(song)}
                alphabet={alphabet}
                setAlphabet={setAlphabet}
                activeSongbook={activeSongbook}
                onClearSongbook={() => setActiveSongbook(null)}
                currentLanguage={language}
                activeCategory={category}
                onSelectCategory={setCategory}
                allSongs={songs}
              />
            </div>

            {/* Song Detail (right column on desktop or full screen on mobile) */}
            {selectedSong && (
              <div className="lg:col-span-7 xl:col-span-7 lg:sticky lg:top-36 lg:h-[calc(100vh-10rem)] fixed inset-0 lg:static z-40 bg-slate-50 dark:bg-slate-950 lg:bg-transparent lg:dark:bg-transparent p-0 lg:p-0 overflow-hidden flex flex-col">
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

      {/* Floating Audio/Video Player */}
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

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-200 dark:border-slate-800 py-6 text-center text-xs text-slate-500">
        <p>సార్వత్రిక క్రైస్తవ కీర్తనలు | All Christian Songs — 3,773 Songs with Audio/Video, Chords & Lyrics</p>
      </footer>

    </div>
  );
}
