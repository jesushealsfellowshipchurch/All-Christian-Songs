import React, { useState, useEffect } from 'react';
import { Grid3X3, ChevronDown } from 'lucide-react';

const TELUGU_LETTERS = [
  'అ', 'ఆ', 'ఇ', 'ఈ', 'ఉ', 'ఊ', 'ఎ', 'ఏ', 'ఐ', 'ఒ', 'ఓ',
  'క', 'ఖ', 'గ', 'ఘ', 'చ', 'జ', 'డ', 'త', 'ద', 'ధ', 'న',
  'ప', 'ఫ', 'బ', 'భ', 'మ', 'య', 'ర', 'ల', 'వ', 'శ', 'ష', 'స', 'హ'
];

const ENGLISH_LETTERS = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
  'N', 'O', 'P', 'R', 'S', 'T', 'U', 'V', 'W', 'Y'
];

const HINDI_LETTERS = [
  'आ', 'इ', 'उ', 'ख', 'च', 'ज', 'झ', 'त', 'द', 'ध', 'न', 'प',
  'य', 'र', 'ल', 'व', 'स', 'ह'
];

export default function BrowseByLetter({ activeLetter, onSelectLetter, currentLanguage = 'all' }) {
  // Determine initial letter mode from currentLanguage
  const getInitialMode = (lang) => {
    if (lang === 'hindi') return 'hindi';
    if (lang === 'english') return 'english';
    return 'telugu';
  };

  const [letterMode, setLetterMode] = useState(() => getInitialMode(currentLanguage));

  // Sync letter mode when user switches top-level language tabs
  useEffect(() => {
    if (currentLanguage === 'hindi') setLetterMode('hindi');
    else if (currentLanguage === 'english') setLetterMode('english');
    else if (currentLanguage === 'telugu') setLetterMode('telugu');
  }, [currentLanguage]);

  // Select active letter array
  const letters = 
    letterMode === 'hindi' ? HINDI_LETTERS :
    letterMode === 'english' ? ENGLISH_LETTERS :
    TELUGU_LETTERS;

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
        <div className="flex items-center justify-between px-3 py-2.5 sm:py-3 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-800/40 flex-wrap gap-2">
          <h2 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-widest flex items-center gap-2 leading-normal py-1 m-0">
            <Grid3X3 className="w-3.5 h-3.5 text-amber-500" />
            <span>Browse by Letter</span>
          </h2>

          <div className="flex items-center gap-1.5">
            {/* Script / Language Switcher Tabs */}
            <div className="flex items-center p-0.5 bg-slate-200/70 dark:bg-slate-800 rounded-lg text-[11px] font-bold">
              <button
                onClick={() => { setLetterMode('telugu'); onSelectLetter(null); }}
                className={`px-2.5 py-1 rounded-md transition ${
                  letterMode === 'telugu'
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400'
                }`}
                title="Telugu letters"
              >
                తె
              </button>
              <button
                onClick={() => { setLetterMode('english'); onSelectLetter(null); }}
                className={`px-2.5 py-1 rounded-md transition ${
                  letterMode === 'english'
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400'
                }`}
                title="English letters"
              >
                En
              </button>
              <button
                onClick={() => { setLetterMode('hindi'); onSelectLetter(null); }}
                className={`px-2.5 py-1 rounded-md transition ${
                  letterMode === 'hindi'
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400'
                }`}
                title="Hindi letters"
              >
                हि
              </button>
            </div>

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
          <div className="flex flex-wrap gap-[5px] sm:gap-1.5 animate-fade-in">
            {letters.map((letter) => {
              const isSelected = activeLetter === letter;
              return (
                <button
                  key={letter}
                  onClick={() => handleLetterClick(letter)}
                  className={`relative w-[34px] h-[34px] sm:w-10 sm:h-10 rounded-lg font-telugu text-sm font-bold transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-amber-500/50 ${
                    isSelected
                      ? 'text-white shadow-lg shadow-amber-500/25 scale-110 z-10 ring-2 ring-amber-400/60 bg-gradient-to-br from-amber-500 to-amber-600'
                      : 'bg-slate-100/90 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200/90 dark:border-slate-700 hover:bg-amber-500/15 hover:text-amber-600 dark:hover:bg-amber-500/20 dark:hover:text-amber-300 dark:hover:border-amber-500/50 hover:border-amber-400/50 hover:scale-105 hover:shadow-xs'
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
