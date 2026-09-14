import React, { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, Minimize2, Type } from 'lucide-react';

export default function PresentationModal({
  song,
  isOpen,
  onClose
}) {
  const [slideIndex, setSlideIndex] = useState(0);
  const [useTransliterated, setUseTransliterated] = useState(false);

  // Parse stanzas: group lines by empty lines or stanzas
  const rawLines = useTransliterated 
    ? (song?.lyrics_transliterated || song?.lyrics_original || []) 
    : (song?.lyrics_original || []);

  // Split lines into chunks of ~4 lines for presentation slides
  const slides = React.useMemo(() => {
    if (!rawLines || rawLines.length === 0) return [];
    const chunks = [];
    let currentChunk = [];

    for (let i = 0; i < rawLines.length; i++) {
      const line = rawLines[i].trim();
      if (!line && currentChunk.length > 0) {
        chunks.push(currentChunk.join('\n'));
        currentChunk = [];
      } else if (line) {
        currentChunk.push(line);
        if (currentChunk.length >= 4) {
          chunks.push(currentChunk.join('\n'));
          currentChunk = [];
        }
      }
    }
    if (currentChunk.length > 0) {
      chunks.push(currentChunk.join('\n'));
    }
    return chunks;
  }, [rawLines]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    setSlideIndex(0);

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
        setSlideIndex(prev => Math.min(slides.length - 1, prev + 1));
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        setSlideIndex(prev => Math.max(0, prev - 1));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, slides.length]);

  if (!isOpen || !song) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black text-white flex flex-col justify-between p-6 sm:p-12 select-none">
      
      {/* Top Floating Controls */}
      <div className="flex items-center justify-between opacity-80 hover:opacity-100 transition">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
            {song.title}
          </h2>
          {song.title_transliterated && (
            <p className="text-sm text-slate-400">{song.title_transliterated}</p>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Script switcher */}
          {song.lyrics_transliterated && song.lyrics_transliterated.length > 0 && (
            <button
              onClick={() => setUseTransliterated(!useTransliterated)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold text-white transition"
            >
              <Type className="w-3.5 h-3.5" />
              <span>{useTransliterated ? 'English Translit' : 'Original Script'}</span>
            </button>
          )}

          {/* Close presentation */}
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition"
            title="Exit Presentation (Esc)"
          >
            <Minimize2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Center Stanza Display */}
      <div className="flex-1 flex items-center justify-center text-center px-4 max-w-5xl mx-auto">
        {slides.length > 0 ? (
          <div className="text-3xl sm:text-5xl md:text-6xl font-bold leading-relaxed tracking-wide text-white whitespace-pre-line telugu-text drop-shadow-lg">
            {slides[slideIndex]}
          </div>
        ) : (
          <div className="text-slate-500 text-xl">No lyrics to display.</div>
        )}
      </div>

      {/* Bottom Progress & Slide Controls */}
      <div className="flex items-center justify-between opacity-80 hover:opacity-100 transition">
        <button
          onClick={() => setSlideIndex(prev => Math.max(0, prev - 1))}
          disabled={slideIndex === 0}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-20 text-sm font-semibold transition"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Previous</span>
        </button>

        <span className="text-sm font-mono tracking-widest text-slate-400">
          {slides.length > 0 ? slideIndex + 1 : 0} / {slides.length}
        </span>

        <button
          onClick={() => setSlideIndex(prev => Math.min(slides.length - 1, prev + 1))}
          disabled={slideIndex >= slides.length - 1}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-20 text-sm font-semibold transition"
        >
          <span>Next</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

    </div>
  );
}
