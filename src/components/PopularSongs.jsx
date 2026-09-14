import React from 'react';
import { Flame, ArrowRight, Heart } from 'lucide-react';

export default function PopularSongs({
  songs = [],
  onSelectSong,
  favorites = [],
  onToggleFavorite,
  onViewAll
}) {
  const popularList = [
    {
      num: '001',
      titleTel: 'యేసయ్య నా హృదయంలో',
      titleEn: 'Yesayya Naa Hrudayamulo',
      img: './images/card-001.jpg',
      searchTarget: 'అపరాధిని యేసయ్యా'
    },
    {
      num: '002',
      titleTel: 'నీ కృపయే చాలును',
      titleEn: 'Nee Krupaye Chalunu',
      img: './images/card-002.jpg',
      searchTarget: 'అంకితం నీకే దేవా'
    },
    {
      num: '003',
      titleTel: 'ఆరాధన ఆరాధన',
      titleEn: 'Aaradhana Aaradhana',
      img: './images/card-003.jpg',
      searchTarget: 'అన్ని వేళల ఆరాధన'
    },
    {
      num: '004',
      titleTel: 'ప్రభు నీవే నా బలం',
      titleEn: 'Prabhu Nive Naa Balam',
      img: './images/card-004.jpg',
      searchTarget: 'అడుగుడి మీరు మన ప్రభువిచ్చున్'
    }
  ];

  const handleCardClick = (item) => {
    // find song matching the search target in the catalog
    const song = songs.find(s => 
      (s.t && s.t.includes(item.searchTarget)) || 
      (s.t && s.t.includes(item.titleTel)) ||
      (s.tr && s.tr.toLowerCase().includes(item.titleEn.toLowerCase()))
    ) || songs[0];

    if (onSelectSong && song) {
      onSelectSong(song);
    }
  };

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-12 sm:mb-16">
      
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-500">
            <Flame className="w-4 h-4 fill-orange-500" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-wide">
              Popular Songs
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Most loved songs by our community
            </p>
          </div>
        </div>

        <button
          onClick={onViewAll}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 transition"
        >
          <span>View All Songs</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* 4 Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {popularList.map((item, idx) => {
          const songObj = songs.find(s => 
            (s.t && s.t.includes(item.searchTarget)) || 
            (s.t && s.t.includes(item.titleTel))
          ) || songs[idx];

          const isFav = songObj && favorites.includes(songObj.id);

          return (
            <div
              key={idx}
              className="group relative rounded-2xl overflow-hidden bg-slate-900 border border-slate-700/60 shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1.5 flex flex-col justify-between h-64 sm:h-72"
            >
              {/* Background Image with Dark Vignette */}
              <div className="absolute inset-0 z-0 overflow-hidden">
                <img
                  src={item.img}
                  alt={item.titleEn}
                  className="w-full h-full object-cover object-center group-hover:scale-110 transition-transform duration-700 ease-out"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-slate-950/30" />
              </div>

              {/* Top Row: Song Number + Favorite Button */}
              <div className="relative z-10 p-3.5 flex items-center justify-between">
                <span className="px-2.5 py-1 rounded-md text-xs font-bold font-mono bg-slate-900/75 backdrop-blur-md text-slate-300 border border-slate-700/50 shadow-sm">
                  {item.num}
                </span>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onToggleFavorite && songObj) {
                      onToggleFavorite(songObj.id);
                    }
                  }}
                  className="w-8 h-8 rounded-full bg-slate-900/60 hover:bg-slate-900/90 backdrop-blur-md border border-slate-700/40 flex items-center justify-center text-slate-300 hover:text-rose-400 transition"
                  title={isFav ? "Remove from favorites" : "Add to favorites"}
                >
                  <Heart className={`w-4 h-4 ${isFav ? 'text-rose-500 fill-rose-500' : ''}`} />
                </button>
              </div>

              {/* Bottom Row: Title + Transliteration + View Lyrics button */}
              <div className="relative z-10 p-4 pt-0">
                <h3 className="text-lg font-bold font-telugu text-white drop-shadow-md truncate">
                  {item.titleTel}
                </h3>
                <p className="text-xs text-slate-300/90 truncate mt-0.5 mb-3 font-sans">
                  {item.titleEn}
                </p>

                <button
                  onClick={() => handleCardClick(item)}
                  className="w-full py-2 px-3.5 rounded-full text-xs font-semibold text-white bg-white/15 hover:bg-amber-500 hover:text-slate-950 border border-white/20 hover:border-amber-400 backdrop-blur-md transition-all duration-200 flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <span>View Lyrics</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

    </section>
  );
}
