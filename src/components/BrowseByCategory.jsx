import React, { useState, useMemo } from 'react';
import {
  Tag,
  ChevronUp,
  ChevronDown,
  HandHeart,
  Sparkles,
  Rainbow,
  Star,
  BookOpen,
  Sun,
  Feather,
  Heart,
  Compass,
  Flame,
  GraduationCap,
  Church,
  Gift
} from 'lucide-react';

const CATEGORIES = [
  { id: 'Worship', name: 'Worship', icon: HandHeart, color: 'bg-amber-500/10 text-amber-500 dark:text-amber-400' },
  { id: 'Praise', name: 'Praise', icon: Sparkles, color: 'bg-amber-500/10 text-amber-500 dark:text-amber-300' },
  { id: 'Hope', name: 'Hope', icon: Rainbow, color: 'bg-sky-500/10 text-sky-500 dark:text-sky-300' },
  { id: 'Christmas', name: 'Christmas', icon: Star, color: 'bg-red-500/10 text-red-500 dark:text-red-300' },
  { id: 'Gospel', name: 'Gospel', icon: BookOpen, color: 'bg-emerald-500/10 text-emerald-500 dark:text-emerald-300' },
  { id: 'Encouraging', name: 'Encouraging', icon: Sun, color: 'bg-yellow-500/10 text-yellow-500 dark:text-yellow-300' },
  { id: 'Prayer', name: 'Prayer', icon: Feather, color: 'bg-blue-500/10 text-blue-500 dark:text-blue-300' },
  { id: 'Comfort', name: 'Comfort', icon: Heart, color: 'bg-teal-500/10 text-teal-500 dark:text-teal-300' },
  { id: 'Second Coming', name: 'Second Coming', icon: Compass, color: 'bg-cyan-500/10 text-cyan-500 dark:text-cyan-300' },
  { id: 'Commitment', name: 'Commitment', icon: Flame, color: 'bg-orange-500/10 text-orange-500 dark:text-orange-300' },
  { id: 'Sunday School', name: 'Sunday School', icon: GraduationCap, color: 'bg-lime-500/10 text-lime-600 dark:text-lime-300' },
  { id: 'Repentance', name: 'Repentance', icon: Church, color: 'bg-violet-500/10 text-violet-500 dark:text-violet-300' },
  { id: 'Thanksgiving', name: 'Thanksgiving', icon: Gift, color: 'bg-orange-500/10 text-orange-500 dark:text-orange-300' },
];

export default function BrowseByCategory({
  songs = [],
  activeCategory,
  onSelectCategory
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Calculate live song count per category
  const counts = useMemo(() => {
    const map = {};
    if (!songs || !Array.isArray(songs)) return map;

    for (const song of songs) {
      if (song.cats && Array.isArray(song.cats)) {
        for (const c of song.cats) {
          const clean = c.toLowerCase().replace(/ songs$/, '').trim();
          map[clean] = (map[clean] || 0) + 1;
        }
      }
    }
    return map;
  }, [songs]);

  return (
    <div className="w-full">
      <div className="p-3 sm:p-4 rounded-xl bg-slate-50/70 dark:bg-slate-900/90 border border-slate-200/90 dark:border-slate-800 shadow-xs">
        
        {/* Header Strip with Expand/Collapse */}
        <div
          className="flex items-center justify-between py-1 cursor-pointer select-none"
          onClick={() => setIsExpanded(prev => !prev)}
        >
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <Tag className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <p className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-widest leading-normal py-1 m-0">
              Browse by Category
            </p>
            {activeCategory && (
              <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md">
                Filtered: {activeCategory}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {activeCategory && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectCategory(null);
                }}
                className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 underline mr-1 transition"
              >
                Show All
              </button>
            )}
            <span className="text-slate-400 dark:text-slate-500">
              {isExpanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </span>
          </div>
        </div>

        {/* Collapsible Categories Grid */}
        {isExpanded && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-2 mt-3 animate-fade-in">
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const isSelected = activeCategory === cat.id;
              const key = cat.name.toLowerCase();
              const count = counts[key] || 0;

              return (
                <button
                  key={cat.id}
                  onClick={() => onSelectCategory(isSelected ? null : cat.id)}
                  className={`group relative flex items-center gap-1.5 sm:gap-2.5 p-1.5 sm:p-2.5 rounded-xl border transition-all duration-200 text-left focus:outline-none focus:ring-2 focus:ring-amber-500/50 hover:shadow-sm hover:-translate-y-0.5 cursor-pointer ${
                    isSelected
                      ? 'border-amber-500 dark:border-amber-400 bg-amber-50/90 dark:bg-amber-950/40 ring-1 ring-amber-500/80 shadow-sm scale-[1.02]'
                      : 'border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/90 hover:border-amber-400/40 dark:hover:border-amber-500/40 hover:bg-amber-500/5'
                  }`}
                  title={`Filter by ${cat.name} (${count} songs)`}
                >
                  <div
                    className={`shrink-0 w-7 h-7 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110 ${cat.color}`}
                  >
                    <Icon className="w-3.5 h-3.5 sm:w-[18px] sm:h-[18px]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] sm:text-[12px] font-semibold leading-tight truncate text-slate-900 dark:text-slate-100">
                      {cat.name}
                    </p>
                    <p className="text-[10px] sm:text-[10.5px] text-slate-500 dark:text-slate-400 tabular-nums leading-tight mt-0.5">
                      {count} {count === 1 ? 'song' : 'songs'}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
}
