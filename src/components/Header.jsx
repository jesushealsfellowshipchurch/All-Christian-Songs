import React from 'react';
import { Search, X, Moon, Sun, Music2, BookOpen, Guitar, Video, FileText } from 'lucide-react';

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
  onOpenSongbooks
}) {
  return (
    <header className="sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          
          {/* Logo */}
          <div className="flex items-center gap-3 shrink-0 cursor-pointer" onClick={() => { setSearchQuery(''); setFilterType('all'); setLanguage('all'); }}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-brand-500/20">
              <Music2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white leading-tight font-telugu">
                సార్వత్రిక క్రైస్తవ కీర్తనలు
              </h1>
              <span className="text-[11px] font-semibold text-brand-600 dark:text-brand-400 tracking-wide block">
                All Christian Songs
              </span>
            </div>
          </div>

          {/* Center: Search Bar */}
          <div className="flex-1 max-w-xl relative">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
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
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-2">
            {/* Songbooks Button */}
            <button
              onClick={onOpenSongbooks}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition"
              title="Browse Songbooks"
            >
              <BookOpen className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
              <span className="hidden sm:inline">Songbooks</span>
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
        </div>

        {/* Secondary Navigation: Language & Feature Filter Bar */}
        <div className="flex items-center justify-between overflow-x-auto py-2.5 gap-4 no-scrollbar border-t border-slate-100 dark:border-slate-800/60 text-xs">
          {/* Languages */}
          <div className="flex items-center gap-1 shrink-0">
            {[
              { id: 'all', label: 'All Languages' },
              { id: 'telugu', label: 'Telugu (తెలుగు)' },
              { id: 'english', label: 'English' },
              { id: 'hindi', label: 'Hindi (हिंदी)' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setLanguage(tab.id)}
                className={`px-3 py-1 rounded-full font-medium transition ${
                  language === tab.id
                    ? 'bg-brand-600 text-white shadow-sm'
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
              { id: 'video', label: 'Video / Audio (2,426)', icon: Video, color: 'text-rose-500' },
              { id: 'ppt', label: 'Has PPT', icon: FileText, color: 'text-emerald-500' },
            ].map(f => {
              const Icon = f.icon;
              return (
                <button
                  key={f.id}
                  onClick={() => setFilterType(f.id)}
                  className={`flex items-center gap-1 px-3 py-1 rounded-full font-medium transition ${
                    filterType === f.id
                      ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
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
