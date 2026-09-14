import React, { useState, useEffect } from 'react';
import { X, BookOpen, Music, ChevronRight } from 'lucide-react';

export default function SongbooksModal({
  isOpen,
  onClose,
  onSelectSongbook
}) {
  const [songbooks, setSongbooks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    fetch('./data/songbooks.json')
      .then(res => res.json())
      .then(data => {
        setSongbooks(data || []);
        setLoading(false);
      })
      .catch(err => {
        console.error("Error loading songbooks:", err);
        setLoading(false);
      });
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Songbook Collections</h3>
              <p className="text-xs text-slate-500">Browse official hymnals & collections</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content list */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-2.5">
          {loading ? (
            <div className="py-12 text-center text-slate-400 text-sm">
              Loading collections...
            </div>
          ) : (
            songbooks.map((book) => (
              <div
                key={book.id || book.slug}
                onClick={() => {
                  onSelectSongbook(book);
                  onClose();
                }}
                className="group p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 hover:border-brand-500 dark:hover:border-brand-500 hover:bg-brand-50/50 dark:hover:bg-brand-950/30 transition cursor-pointer flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center group-hover:bg-brand-500 group-hover:text-white transition">
                    <Music className="w-4 h-4 text-slate-600 dark:text-slate-300 group-hover:text-white" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-brand-600 dark:group-hover:text-brand-400 transition">
                      {book.title}
                    </h4>
                    {book.description && (
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                        {book.description}
                      </p>
                    )}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-brand-500 group-hover:translate-x-0.5 transition" />
              </div>
            ))
          )}
        </div>

      </div>
    </div>
  );
}
