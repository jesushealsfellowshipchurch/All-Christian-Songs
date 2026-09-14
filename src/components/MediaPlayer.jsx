import React, { useState, useEffect } from 'react';
import { X, Video, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';

export default function MediaPlayer({
  activeMedia,
  onClose
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isAutoScroll, setIsAutoScroll] = useState(false);

  // Auto-expand whenever active media changes
  useEffect(() => {
    if (activeMedia) {
      setIsExpanded(true);
    }
  }, [activeMedia?.id, activeMedia?.slug, activeMedia?.youtube_id, activeMedia?.yt]);

  // Auto-scroll loop when active
  useEffect(() => {
    if (!isAutoScroll) return;
    const interval = setInterval(() => {
      window.scrollBy({ top: 1, behavior: 'smooth' });
    }, 80);
    return () => clearInterval(interval);
  }, [isAutoScroll]);

  const videoId = activeMedia?.youtube_id || activeMedia?.yt;
  if (!activeMedia || !videoId) return null;

  const title = activeMedia.title || activeMedia.t || 'Worship Song';
  const subtitle = activeMedia.title_transliterated || activeMedia.tr || activeMedia.author_english || activeMedia.auth || 'YouTube Audio / Video';

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm sm:max-w-md w-full transition-all duration-300">
      <div className="bg-slate-900/95 backdrop-blur-md text-white rounded-2xl shadow-2xl border border-slate-700/80 overflow-hidden ring-1 ring-white/10">
        
        {/* Expanded Video Embed */}
        {isExpanded && (
          <div className="relative aspect-video w-full bg-black">
            <iframe
              src={`https://www.youtube.com/embed/${videoId}?autoplay=1&enablejsapi=1&rel=0`}
              title={title}
              className="w-full h-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        )}

        {/* Compact Controller Bar */}
        <div className="p-3.5 flex items-center justify-between gap-3 bg-slate-900">
          
          <div 
            className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer" 
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? "Collapse video" : "Expand video"}
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-rose-600 to-red-500 flex items-center justify-center shrink-0 shadow-sm shadow-rose-500/30">
              <Video className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <h4 className="text-xs font-bold text-white truncate leading-tight">
                {title}
              </h4>
              <p className="text-[11px] text-slate-400 truncate">
                {subtitle}
              </p>
            </div>
          </div>

          {/* Player controls */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Watch on YouTube button */}
            <a
              href={`https://www.youtube.com/watch?v=${videoId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition"
              title="Open directly on YouTube"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>

            {/* Auto-scroll toggle */}
            <button
              onClick={() => setIsAutoScroll(!isAutoScroll)}
              className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition ${
                isAutoScroll
                  ? 'bg-brand-500 text-white shadow-xs'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
              title="Auto-scroll lyrics while playing"
            >
              Scroll
            </button>

            {/* Expand / Minimize video */}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title={isExpanded ? "Collapse video bar" : "Expand video player"}
            >
              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>

            {/* Close media */}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="Stop and Close Player"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}
