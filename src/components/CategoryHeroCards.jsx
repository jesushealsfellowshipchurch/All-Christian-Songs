import React from 'react';
import { Music2, HandHeart, Users, Star, TreePine, Sun, Heart } from 'lucide-react';

export default function CategoryHeroCards({ activeCategory, onSelectCategory }) {
  const categories = [
    {
      id: 'all',
      title: 'All Songs',
      sub: 'Browse all songs',
      icon: Music2,
      color: 'from-sky-500/20 via-blue-600/10 to-transparent',
      border: 'border-sky-500/30 hover:border-sky-400',
      activeBorder: 'ring-2 ring-sky-400 border-sky-400 bg-sky-950/40',
      iconColor: 'text-sky-400',
      filterValue: null
    },
    {
      id: 'prayer',
      title: 'Prayer Songs',
      sub: 'ప్రార్థన పాటలు',
      icon: HandHeart,
      color: 'from-amber-500/20 via-yellow-600/10 to-transparent',
      border: 'border-amber-500/30 hover:border-amber-400',
      activeBorder: 'ring-2 ring-amber-400 border-amber-400 bg-amber-950/40',
      iconColor: 'text-amber-400',
      filterValue: 'Prayer'
    },
    {
      id: 'worship',
      title: 'Worship Songs',
      sub: 'ఆరాధన పాటలు',
      icon: Users,
      color: 'from-purple-500/20 via-indigo-600/10 to-transparent',
      border: 'border-purple-500/30 hover:border-purple-400',
      activeBorder: 'ring-2 ring-purple-400 border-purple-400 bg-purple-950/40',
      iconColor: 'text-purple-400',
      filterValue: 'Worship'
    },
    {
      id: 'praise',
      title: 'Praise Songs',
      sub: 'స్తుతి పాటలు',
      icon: Star,
      color: 'from-yellow-500/20 via-amber-600/10 to-transparent',
      border: 'border-yellow-500/30 hover:border-yellow-400',
      activeBorder: 'ring-2 ring-yellow-400 border-yellow-400 bg-yellow-950/40',
      iconColor: 'text-yellow-400',
      filterValue: 'Praise'
    },
    {
      id: 'christmas',
      title: 'Christmas Songs',
      sub: 'క్రిస్మస్ పాటలు',
      icon: TreePine,
      color: 'from-emerald-500/20 via-green-600/10 to-transparent',
      border: 'border-emerald-500/30 hover:border-emerald-400',
      activeBorder: 'ring-2 ring-emerald-400 border-emerald-400 bg-emerald-950/40',
      iconColor: 'text-emerald-400',
      filterValue: 'Christmas'
    },
    {
      id: 'easter',
      title: 'Easter Songs',
      sub: 'ఈస్టర్ పాటలు',
      icon: Sun,
      color: 'from-rose-500/20 via-pink-600/10 to-transparent',
      border: 'border-rose-500/30 hover:border-rose-400',
      activeBorder: 'ring-2 ring-rose-400 border-rose-400 bg-rose-950/40',
      iconColor: 'text-rose-400',
      filterValue: 'Easter'
    },
    {
      id: 'children',
      title: "Children's Songs",
      sub: 'బాలల పాటలు',
      icon: Heart,
      color: 'from-cyan-500/20 via-teal-600/10 to-transparent',
      border: 'border-cyan-500/30 hover:border-cyan-400',
      activeBorder: 'ring-2 ring-cyan-400 border-cyan-400 bg-cyan-950/40',
      iconColor: 'text-cyan-400',
      filterValue: 'Sunday School'
    }
  ];

  const handleCardClick = (cat) => {
    if (onSelectCategory) {
      onSelectCategory(cat.filterValue);
    }
    const catalogEl = document.getElementById('songs-catalog');
    if (catalogEl) {
      catalogEl.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section className="relative z-20 max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 mt-2 sm:mt-3 mb-4 sm:mb-6">
      <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-2.5">
        {categories.map((cat) => {
          const Icon = cat.icon;
          const isActive =
            (cat.filterValue === null && !activeCategory) ||
            (activeCategory && activeCategory.toLowerCase() === (cat.filterValue || '').toLowerCase());

          return (
            <button
              key={cat.id}
              onClick={() => handleCardClick(cat)}
              className={`group relative flex items-center gap-2 px-3 sm:px-3.5 min-h-[44px] h-[44px] sm:h-[48px] rounded-xl border transition-all duration-150 transform hover:-translate-y-[1px] active:translate-y-0 text-left ${
                isActive
                  ? `${cat.activeBorder} text-white font-bold shadow-sm`
                  : 'bg-slate-900/90 border-slate-800/90 hover:border-slate-700 hover:bg-slate-850 text-slate-300 hover:text-white shadow-xs'
              }`}
            >
              {/* Compact subtle icon badge */}
              <span className={`p-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60 flex items-center justify-center ${cat.iconColor} shrink-0`}>
                <Icon className="w-4 h-4" />
              </span>

              {/* Category Title */}
              <span className="text-xs sm:text-[13px] font-semibold tracking-wide whitespace-nowrap">
                {cat.title}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
