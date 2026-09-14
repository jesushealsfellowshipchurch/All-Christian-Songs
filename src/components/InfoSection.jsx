import React from 'react';
import { Clock, ChevronRight, Check, Heart, Sparkles } from 'lucide-react';

export default function InfoSection({ songs = [], onSelectSong }) {
  const recentItems = [
    { num: '005', titleTel: 'మంచి మంచిదేవుడా', titleEn: 'Manchi Manchi Devudaa', query: 'ఎంత మంచి కాపరి' },
    { num: '006', titleTel: 'నా జీవితంలో నీవే', titleEn: 'Naa Jeevithamlo Nive', query: 'అంకితం ప్రభూ నా జీవితం' },
    { num: '007', titleTel: 'హల్లెలూయా హల్లెలూయా', titleEn: 'Hallelujah Hallelujah', query: 'ఆరాధింతును హల్లెలూయా' },
    { num: '008', titleTel: 'ప్రేమించువాడా యేసయ్య', titleEn: 'Preminchuvaadaa Yesayya', query: 'అపరాధిని యేసయ్యా' }
  ];

  const handleRecentClick = (item) => {
    const song = songs.find(s => s.t && s.t.includes(item.query)) || songs[0];
    if (onSelectSong && song) {
      onSelectSong(song);
    }
  };

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-16">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Card 1: Recent Updates */}
        <div className="p-6 rounded-3xl bg-slate-900/70 dark:bg-slate-900/70 border border-slate-800 shadow-xl backdrop-blur-md flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Clock className="w-4 h-4" />
              </div>
              <h3 className="text-base sm:text-lg font-bold text-white tracking-wide">
                Recent Updates
              </h3>
            </div>

            <div className="divide-y divide-slate-800/80">
              {recentItems.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => handleRecentClick(item)}
                  className="w-full py-3 flex items-center justify-between gap-3 text-left hover:text-amber-300 transition group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-mono text-xs font-bold text-slate-400 group-hover:text-amber-400">
                      {item.num}
                    </span>
                    <div className="min-w-0">
                      <p className="font-telugu font-bold text-sm text-slate-200 group-hover:text-white truncate">
                        {item.titleTel}
                      </p>
                      <p className="text-xs text-slate-400 truncate mt-0.5">
                        {item.titleEn}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-amber-400 transition shrink-0 group-hover:translate-x-0.5" />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Card 2: Scripture Inspiration Quote */}
        <div className="relative p-8 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900/90 to-amber-950/30 border border-amber-500/20 shadow-xl backdrop-blur-md flex flex-col items-center justify-center text-center overflow-hidden">
          {/* Subtle gold glowing orb in background */}
          <div className="absolute -top-16 -right-16 w-36 h-36 rounded-full bg-amber-500/10 blur-2xl pointer-events-none" />

          {/* Flourish Leaf / Wheat SVG */}
          <div className="mb-4 text-amber-400/80">
            <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 2C6.5 2 2 6.5 2 12c0 3.5 1.8 6.6 4.5 8.4" />
              <path d="M12 22c5.5 0 10-4.5 10-10 0-3.5-1.8-6.6-4.5-8.4" />
              <path d="M8 12c1.5-2 4-3 6-2-1 2-2.5 4.5-4 5-1-.5-1.8-1.8-2-3Z" fill="currentColor" fillOpacity="0.2" />
            </svg>
          </div>

          <blockquote className="font-serif italic text-xl sm:text-2xl text-amber-100 leading-relaxed max-w-sm drop-shadow">
            &ldquo;Let everything that has breath praise the Lord!&rdquo;
          </blockquote>

          <cite className="block mt-4 not-italic font-sans text-xs tracking-widest uppercase font-semibold text-amber-400/90">
            Psalm 150:6
          </cite>
        </div>

        {/* Card 3: Why This Website? */}
        <div className="p-6 rounded-3xl bg-slate-900/70 dark:bg-slate-900/70 border border-slate-800 shadow-xl backdrop-blur-md flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
                <Heart className="w-4 h-4 fill-rose-500/30 text-rose-400" />
              </div>
              <h3 className="text-base sm:text-lg font-bold text-white tracking-wide">
                Why This Website?
              </h3>
            </div>

            <ul className="space-y-3 text-xs sm:text-sm text-slate-300">
              <li className="flex items-start gap-2.5">
                <div className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                  <Check className="w-3 h-3" />
                </div>
                <span>A complete collection of Telugu Christian songs</span>
              </li>
              <li className="flex items-start gap-2.5">
                <div className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                  <Check className="w-3 h-3" />
                </div>
                <span>Easy search by title, number or lyrics</span>
              </li>
              <li className="flex items-start gap-2.5">
                <div className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                  <Check className="w-3 h-3" />
                </div>
                <span>Categorized for easy access</span>
              </li>
              <li className="flex items-start gap-2.5">
                <div className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                  <Check className="w-3 h-3" />
                </div>
                <span>Mobile friendly and fast</span>
              </li>
              <li className="flex items-start gap-2.5">
                <div className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                  <Check className="w-3 h-3" />
                </div>
                <span className="font-semibold text-amber-200">Made with love for God's glory</span>
              </li>
            </ul>
          </div>
        </div>

      </div>
    </section>
  );
}
