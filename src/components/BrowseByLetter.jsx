import React, { useState } from 'react';
import { Grid3X3, Languages, ChevronDown } from 'lucide-react';

const TELUGU_LETTERS = [
  'అ', 'ఆ', 'ఇ', 'ఈ', 'ఉ', 'ఊ', 'ఎ', 'ఏ', 'ఐ', 'ఒ', 'ఓ',
  'క', 'ఖ', 'గ', 'ఘ', 'చ', 'జ', 'డ', 'త', 'ద', 'ధ', 'న',
  'ప', 'ఫ', 'బ', 'భ', 'మ', 'య', 'ర', 'ల', 'వ', 'శ', 'ష', 'స', 'హ'
];

const ENGLISH_LETTERS = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
  'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'
];

export default function BrowseByLetter({ activeLetter, onSelectLetter, currentLanguage }) {
  // Default to Telugu letters if site language is Telugu or all, else English
  const [letterMode, setLetterMode] = useState(currentLanguage === 'english' ? 'english' : 'telugu');

  const letters = letterMode === 'telugu' ? TELUGU_LETTERS : ENGLISH_LETTERS;

  const handleToggleMode = () => {
    setLetterMode(prev => (prev === 'telugu' ? 'english' : 'telugu'));
  };

  const handleLetterClick = (letter) => {
    if (activeLetter === letter) {
      onSelectLetter(null); // toggle off
    } else {
      onSelectLetter(letter);
    }
  };

  const isAllSelected = !activeLetter || activeLetter === 'ALL';

  return (
    <div className="w-full">
      <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
        
        {/* Header Strip */}
        <div className="flex items-center justify-between px-3 py-2.5 sm:py-3 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-800/40">
          <h2 className="text-xs font-bold text-slate-850 dark:text-slate-100 uppercase tracking-widest flex items-center gap-2 leading-normal py-1 m-0">
            <Grid3X3 className="w-3.5 h-3.5 text-amber-500" />
            <span>Browse by Letter</span>
          </h2>

          <div className="flex items-center gap-1.5">
            {/* Toggle Script (Telugu vs English) */}
            <button
              onClick={handleToggleMode}
              className="flex items-center gap-1 text-[11px] font-bold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-amber-500/50 rounded-lg px-2.5 py-1.5 text-slate-500 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-500/10 leading-4"
              title={letterMode === 'telugu' ? "Switch to English letters" : "Switch to Telugu letters"}
            >
              <Languages className="w-3 h-3" />
              <span>{letterMode === 'telugu' ? 'తె' : 'En'}</span>
            </button>

            {/* All Reset Button */}
            <button
              onClick={() => onSelectLetter(null)}
              className={`flex items-center gap-1 text-[11px] font-bold leading-4 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-amber-500/50 rounded-lg px-2.5 py-1.5 ${
                isAllSelected
                  ? 'text-amber-600 dark:text-amber-400 bg-amber-500/10 ring-1 ring-amber-400/30'
                  : 'text-slate-600 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-500/5'
              }`}
              title="Show all songs"
            >
              <span>All</span>
              <ChevronDown className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Letters Grid */}
        <div className="p-2.5 sm:p-3">
          <div className="flex flex-wrap gap-[5px] sm:gap-1.5">
            {letters.map((letter) => {
              const isSelected = activeLetter === letter;
              return (
                <button
                  key={letter}
                  onClick={() => handleLetterClick(letter)}
                  className={`relative w-[34px] h-[34px] sm:w-10 sm:h-10 rounded-lg font-telugu text-sm font-bold transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-amber-500/50 ${
                    isSelected
                      ? 'text-white shadow-lg shadow-amber-500/25 scale-110 z-10 ring-1 ring-amber-400/40 bg-gradient-to-br from-amber-500 to-amber-600'
                      : 'bg-slate-50/90 dark:bg-slate-850/80 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-750/80 hover:bg-amber-500/10 hover:text-amber-600 dark:hover:text-amber-400 hover:border-amber-400/30 hover:scale-105 hover:shadow-xs'
                  }`}
                  title={`Songs starting with ${letter}`}
                >
                  {letter}
                </button>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
