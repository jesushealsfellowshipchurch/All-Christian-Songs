import React, { useRef } from 'react';
import { Search, ArrowRight, Sparkles } from 'lucide-react';

export default function HeroSection({
  searchQuery,
  setSearchQuery,
  onSearchSubmit,
  onSelectCategoryChip
}) {
  const inputRef = useRef(null);

  const quickChips = [
    { label: 'యేసయ్య', query: 'యేసయ్య' },
    { label: 'ప్రార్థన', query: 'ప్రార్థన' },
    { label: 'ఆరాధన', query: 'ఆరాధన' },
    { label: 'క్రిస్మస్', query: 'Christmas' },
    { label: 'ఈస్టర్', query: 'Easter' },
    { label: 'బాలల పాటలు', query: 'Children' },
  ];

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    if (onSearchSubmit) onSearchSubmit(searchQuery);
    const catalogEl = document.getElementById('songs-catalog');
    if (catalogEl) {
      catalogEl.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleChipClick = (chip) => {
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

  return (
    <section className="relative w-full overflow-hidden text-white pt-8 pb-16 sm:pt-14 sm:pb-24">
      {/* Background Image Container with Overlay */}
      <div className="absolute inset-0 z-0">
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
        
        {/* Desktop Side Calligraphy Texts */}
        <div className="hidden lg:flex items-start justify-between pointer-events-none select-none mb-2">
          {/* Left Calligraphy */}
          <div className="text-left opacity-90 max-w-xs transform -translate-y-2 hover:opacity-100 transition duration-300 pointer-events-auto">
            <p className="font-script text-3xl sm:text-4xl text-amber-200/90 drop-shadow-md leading-relaxed tracking-wide">
              Sing to the Lord<br />
              <span className="text-2xl sm:text-3xl text-amber-100/80 pl-4">a new song...</span>
            </p>
            <p className="font-serif italic text-xs tracking-widest text-amber-300/70 mt-1 pl-4 uppercase">
              Psalm 96:1
            </p>
          </div>

          {/* Right Calligraphy */}
          <div className="text-right opacity-90 max-w-xs transform -translate-y-2 hover:opacity-100 transition duration-300 pointer-events-auto">
            <p className="font-script text-3xl sm:text-4xl text-amber-200/90 drop-shadow-md leading-relaxed tracking-wide">
              He is Risen
            </p>
            <p className="font-serif italic text-xs tracking-widest text-amber-300/70 mt-1 uppercase">
              Matthew 28:6
            </p>
          </div>
        </div>

        {/* Center Main Titles */}
        <div className="text-center max-w-4xl mx-auto mt-2 sm:mt-4">
          
          {/* Main Telugu Headline */}
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-bold font-telugu text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-gold-400 to-amber-100 drop-shadow-[0_4px_24px_rgba(203,182,130,0.35)] tracking-wide leading-tight sm:leading-snug">
            సార్వత్రిక క్రైస్తవ కీర్తనలు
          </h1>

          {/* English Subtitle */}
          <h2 className="mt-2 sm:mt-3 text-lg sm:text-2xl md:text-3xl font-semibold tracking-wide text-white drop-shadow-md">
            All Christian Songs
          </h2>

          {/* Tagline */}
          <p className="mt-3 text-xs sm:text-sm font-medium tracking-widest uppercase text-amber-200/80 flex items-center justify-center gap-2 sm:gap-3 flex-wrap">
            <span>Discover</span>
            <span className="text-gold-500">•</span>
            <span>Worship</span>
            <span className="text-gold-500">•</span>
            <span>Sing</span>
            <span className="text-gold-500">•</span>
            <span>Share His Love</span>
          </p>

          {/* Central Search Bar */}
          <div className="mt-8 sm:mt-10 max-w-2xl mx-auto">
            <form
              onSubmit={handleSubmit}
              className="relative flex items-center bg-slate-900/75 backdrop-blur-xl border border-amber-400/30 hover:border-amber-400/50 focus-within:border-amber-400 focus-within:ring-4 focus-within:ring-amber-400/20 rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.5)] transition-all duration-200 group"
            >
              <div className="pl-5 text-amber-400/90 group-focus-within:text-amber-300">
                <Search className="w-5 h-5" />
              </div>

              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by song number, title or lyrics..."
                className="w-full py-4 pl-3 pr-14 text-sm sm:text-base text-white placeholder-slate-400/80 bg-transparent focus:outline-none"
              />

              <button
                type="submit"
                className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 flex items-center justify-center shadow-md transition transform hover:scale-105 active:scale-95"
                title="Search"
              >
                <ArrowRight className="w-5 h-5" />
              </button>
            </form>
          </div>

          {/* Quick Search Chips */}
          <div className="mt-5 flex items-center justify-center gap-2 sm:gap-2.5 flex-wrap">
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

      </div>
    </section>
  );
}
