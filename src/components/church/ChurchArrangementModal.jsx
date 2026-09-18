import React, { useState, useEffect } from 'react';
import { X, Music2, Check, Loader2, Clock, FileText } from 'lucide-react';

const COMMON_KEYS = ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'Em', 'Am', 'Bm', 'F#m', 'C#m'];

export default function ChurchArrangementModal({
  isOpen,
  onClose,
  item,
  onSave
}) {
  const [defaultKey, setDefaultKey] = useState('');
  const [tempoNotes, setTempoNotes] = useState('');
  const [arrangementNotes, setArrangementNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && item) {
      setDefaultKey(item.default_key || '');
      setTempoNotes(item.tempo_notes || '');
      setArrangementNotes(item.arrangement_notes || '');
      setError('');
      setIsSubmitting(false);
    }
  }, [isOpen, item]);

  if (!isOpen || !item) return null;

  const songTitle = item.song?.title || item.song?.title_telugu || 'Hymn Arrangement';
  const songAuthor = item.song?.author || '';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const res = await onSave(item.id, {
        default_key: defaultKey.trim() || null,
        tempo_notes: tempoNotes.trim() || null,
        arrangement_notes: arrangementNotes.trim() || null
      });

      if (res && res.error) {
        setError(res.error);
        setIsSubmitting(false);
      } else {
        onClose();
      }
    } catch (err) {
      setError(err?.message || 'Failed to save arrangement notes.');
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="arrangement-modal-title"
      className="fixed inset-0 z-[110] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
              <Music2 className="w-5 h-5 text-amber-400" />
            </div>
            <div className="min-w-0">
              <h3 id="arrangement-modal-title" className="text-base sm:text-lg font-bold text-white truncate">
                Edit Arrangement Notes
              </h3>
              <p className="text-xs text-slate-400 truncate">
                {songTitle} {songAuthor ? `• ${songAuthor}` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close arrangement modal"
            className="w-11 h-11 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 flex items-center justify-center transition shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs rounded-xl">
              {error}
            </div>
          )}

          {/* Key Selection */}
          <div className="space-y-2">
            <label htmlFor="worship-key-input" className="block text-xs font-bold uppercase tracking-wider text-slate-300">
              Preferred Key
            </label>
            <div className="flex items-center gap-2">
              <input
                id="worship-key-input"
                type="text"
                maxLength={10}
                value={defaultKey}
                onChange={(e) => setDefaultKey(e.target.value)}
                placeholder="e.g. G, D, F#m"
                className="w-32 px-3.5 py-2.5 rounded-xl bg-slate-800/90 border border-slate-700 text-sm font-semibold text-white focus:ring-2 focus:ring-amber-400/50 outline-none"
              />
              <span className="text-xs text-slate-400">
                {item.song?.original_key ? `Original: ${item.song.original_key}` : 'Custom key for church'}
              </span>
            </div>

            {/* Quick Key Selection Chips */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {COMMON_KEYS.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setDefaultKey(k)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition ${
                    defaultKey === k
                      ? 'bg-amber-500 text-slate-950 border-amber-400'
                      : 'bg-slate-800/70 text-slate-300 border-slate-700/80 hover:bg-slate-700'
                  }`}
                >
                  {k}
                </button>
              ))}
              {defaultKey && (
                <button
                  type="button"
                  onClick={() => setDefaultKey('')}
                  className="px-2 py-1 text-[11px] text-slate-400 hover:text-slate-200 underline"
                >
                  Clear Key
                </button>
              )}
            </div>
          </div>

          {/* Tempo Notes */}
          <div className="space-y-2">
            <label htmlFor="worship-tempo-input" className="block text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>Tempo & Feel</span>
            </label>
            <input
              id="worship-tempo-input"
              type="text"
              maxLength={50}
              value={tempoNotes}
              onChange={(e) => setTempoNotes(e.target.value)}
              placeholder="e.g. 72 BPM, Gentle 6/8, Upbeat Praise, Moderate 4/4"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/90 border border-slate-700 text-sm text-white focus:ring-2 focus:ring-amber-400/50 outline-none"
            />
            <p className="text-[11px] text-slate-400">
              Guidance for the worship team during rehearsal and service.
            </p>
          </div>

          {/* Arrangement Notes */}
          <div className="space-y-2">
            <label htmlFor="worship-arrangement-input" className="block text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-amber-400" />
              <span>Arrangement & Flow Notes</span>
            </label>
            <textarea
              id="worship-arrangement-input"
              rows={4}
              maxLength={1000}
              value={arrangementNotes}
              onChange={(e) => setArrangementNotes(e.target.value)}
              placeholder="e.g. Acoustic guitar & vocals intro. Full band enters on Chorus 1. Drum build during Bridge. Acapella reprise at end."
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/90 border border-slate-700 text-sm text-white focus:ring-2 focus:ring-amber-400/50 outline-none leading-relaxed resize-y"
            />
            <div className="flex justify-between items-center text-[11px] text-slate-500">
              <span>Pastoral or musical cues for this congregation.</span>
              <span>{arrangementNotes.length}/1000</span>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="min-h-[44px] px-6 py-2.5 rounded-xl font-bold text-xs bg-amber-500 hover:bg-amber-400 text-slate-950 transition flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Save Notes</span>
                </>
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
