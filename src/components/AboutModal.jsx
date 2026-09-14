import React from 'react';
import { X, Church, Music2, Heart, ExternalLink, ShieldCheck } from 'lucide-react';

export default function AboutModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-xl rounded-3xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden">
        
        {/* Header with Gold Cross */}
        <div className="p-6 bg-gradient-to-r from-slate-900 via-slate-850 to-amber-950/30 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="./images/gold-cross.png"
              alt="Cross"
              className="w-8 h-8 object-contain drop-shadow-[0_0_8px_rgba(203,182,130,0.5)]"
            />
            <div>
              <h3 className="text-lg font-bold text-white tracking-wide">
                About All Christian Songs
              </h3>
              <p className="text-xs text-amber-300/90 font-telugu">
                సార్వత్రిక క్రైస్తవ కీర్తనలు
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 text-sm text-slate-300 max-h-[70vh] overflow-y-auto">
          <p className="leading-relaxed">
            Welcome to <strong className="text-amber-300">All Christian Songs</strong> (సార్వత్రిక క్రైస్తవ కీర్తనలు), a comprehensive spiritual worship resource created to serve the body of Christ worldwide.
          </p>

          <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60 space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
              <Church className="w-4 h-4" />
              <span>Fellowship & Ministry</span>
            </h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              Maintained with love by <strong>Jesus Heals Fellowship Church</strong> in Ambati Satram Area, Vizianagaram, Andhra Pradesh under the pastoral guidance of Rev. Dr. R. Sukumar Patnaik & Ps. R. Syamala Patnaik.
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="font-bold text-white text-xs uppercase tracking-wider text-slate-400">
              Key Features
            </h4>
            <ul className="space-y-1.5 text-xs text-slate-300 list-disc list-inside">
              <li><strong>3,773+ Songs</strong> across Telugu, English, and Hindi.</li>
              <li><strong>Interactive Guitar Chords</strong> with real-time transposition.</li>
              <li><strong>Dual-Script Reading</strong>: Native Telugu/Devanagari script alongside English phonetic transliteration.</li>
              <li><strong>Embedded YouTube Audio & Video</strong> player with auto-scrolling lyrics.</li>
              <li><strong>Church Projector Presentation Mode</strong> with keyboard arrow controls.</li>
              <li><strong>8 Official Hymnal Collections</strong> indexed for instant discovery.</li>
            </ul>
          </div>

          <p className="text-xs text-slate-400 italic pt-2 border-t border-slate-800">
            &ldquo;Speaking to one another with psalms, hymns, and songs from the Spirit. Sing and make music from your heart to the Lord.&rdquo; — Ephesians 5:19
          </p>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-full text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
