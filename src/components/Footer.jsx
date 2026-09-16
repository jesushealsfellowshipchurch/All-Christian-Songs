import React from 'react';
import { Sparkles, Smartphone, Zap, Shield, Heart } from 'lucide-react';

export default function Footer({ onOpenContact, onOpenAbout, onOpenAdmin }) {
  return (
    <footer className="mt-auto bg-slate-950 border-t border-slate-800/80 text-slate-400">
      
      {/* Main Footer Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
          
          {/* Brand with Gold Cross */}
          <div className="flex items-center gap-3">
            <img
              src="./images/gold-cross.png"
              alt="All Christian Songs Cross"
              className="w-8 h-8 object-contain drop-shadow-[0_0_8px_rgba(203,182,130,0.5)]"
            />
            <div>
              <h3 className="text-base font-bold text-white tracking-wide">
                All Christian Songs
              </h3>
              <p className="text-xs text-slate-400/90 font-medium tracking-wider">
                Worship • Lyrics • Share • Grow
              </p>
            </div>
          </div>

          {/* Copyright & Soli Deo Gloria */}
          <div className="text-xs text-slate-400 space-y-1">
            <p>© 2024 All Christian Songs. All rights reserved.</p>
            <p className="text-amber-300/80 italic font-serif">
              For the glory of God | Soli Deo Gloria
            </p>
          </div>

          {/* Links & Socials */}
          <div className="flex flex-col items-center md:items-end gap-3">
            <div className="flex items-center gap-5 text-xs font-semibold text-slate-300">
              <button onClick={onOpenAbout} className="hover:text-amber-300 transition">
                About
              </button>
              <button onClick={onOpenContact} className="hover:text-amber-300 transition">
                Contact
              </button>
              <button onClick={onOpenAdmin} className="hover:text-amber-400 text-slate-400 transition flex items-center gap-1">
                Admin Portal
              </button>
              <a href="#privacy" onClick={(e) => { e.preventDefault(); alert("Privacy: All Christian Songs respects your privacy. No personal data is collected or tracked."); }} className="hover:text-amber-300 transition">
                Privacy
              </a>
              <a href="#terms" onClick={(e) => { e.preventDefault(); alert("Terms: Provided free of charge for personal and church worship use."); }} className="hover:text-amber-300 transition">
                Terms
              </a>
            </div>

            {/* Social Icons */}
            <div className="flex items-center gap-3 text-slate-400">
              <a
                href="https://www.youtube.com/@HepsiSherwin_CK"
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-full bg-slate-900 border border-slate-800 hover:border-red-500/50 hover:text-red-500 flex items-center justify-center transition"
                title="YouTube Channel"
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
              </a>

              <a
                href="https://wa.me/919493034647"
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-full bg-slate-900 border border-slate-800 hover:border-emerald-500/50 hover:text-emerald-400 flex items-center justify-center transition"
                title="WhatsApp Share"
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981z"/></svg>
              </a>

              <a
                href="https://facebook.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-full bg-slate-900 border border-slate-800 hover:border-blue-500/50 hover:text-blue-400 flex items-center justify-center transition"
                title="Facebook"
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
              </a>
            </div>
          </div>

        </div>
      </div>

      {/* Bottom Value Props Ribbon */}
      <div className="border-t border-slate-900 bg-slate-950/80 py-3.5 px-4 text-xs font-medium text-slate-400">
        <div className="max-w-7xl mx-auto flex items-center justify-center sm:justify-between gap-4 flex-wrap text-[11px] sm:text-xs">
          <div className="flex items-center gap-1.5 text-amber-300/90">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Modern & Elegant Design</span>
          </div>

          <div className="flex items-center gap-1.5 text-sky-300/90">
            <Smartphone className="w-3.5 h-3.5" />
            <span>Fully Responsive</span>
          </div>

          <div className="flex items-center gap-1.5 text-yellow-300/90">
            <Zap className="w-3.5 h-3.5" />
            <span>Fast & Lightweight</span>
          </div>

          <div className="flex items-center gap-1.5 text-emerald-300/90">
            <Shield className="w-3.5 h-3.5" />
            <span>Accessible & User Friendly</span>
          </div>

          <div className="flex items-center gap-1.5 text-rose-300/90">
            <Heart className="w-3.5 h-3.5 fill-rose-500/40 text-rose-400" />
            <span>Made for His Glory</span>
          </div>
        </div>
      </div>

    </footer>
  );
}
