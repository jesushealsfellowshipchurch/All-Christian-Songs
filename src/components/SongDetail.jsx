import React, { useState, useEffect } from 'react';
import { 
  X, ArrowLeft, Guitar, Video, FileText, Download, 
  Maximize2, ZoomIn, ZoomOut, RotateCcw, Share2, Copy, Check,
  BookOpen, Heart, Eye, Volume2, Sparkles, ExternalLink,
  Loader2, Pin, PinOff, Lock, KeyRound, AlertCircle, ShieldCheck
} from 'lucide-react';
import { transposeChordSheet, isChordLine } from '../utils/chordTransposer';
import generateSongPptx from '../utils/pptGenerator';
import { isSongPinned, pinSong, unpinSong } from '../utils/pinManager';
import { getSong } from '../services/songRepository';
import { useAuth } from '../context/AuthContext';

export default function SongDetail({
  songSummary,
  onClose,
  onPlayMedia,
  activePlayingId,
  onOpenPresentation
}) {
  const { user, profile } = useAuth();
  const isAdmin = Boolean(user && profile?.role === 'admin');

  const [song, setSong] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('lyrics'); // 'lyrics' | 'chords'
  const [scriptMode, setScriptMode] = useState('original'); // 'original' | 'transliterated' | 'dual'
  const [semitones, setSemitones] = useState(0);
  const [capo, setCapo] = useState(0);
  const [fontSize, setFontSize] = useState(16); // px
  const [copied, setCopied] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [isGeneratingPpt, setIsGeneratingPpt] = useState(false);
  const [pinnedStatus, setPinnedStatus] = useState({ isPinned: false, pinNumber: null });
  const [showPinPrompt, setShowPinPrompt] = useState(false);
  const [pinNumberInput, setPinNumberInput] = useState('');
  const [pinActionError, setPinActionError] = useState('');

  const videoId = song?.youtube_id || songSummary?.yt;

  // Load full song details
  useEffect(() => {
    if (!songSummary) return;
    setLoading(true);
    setSemitones(0);
    setCapo(0);
    setShowVideo(false);

    const target = songSummary.slug || songSummary.id;
    getSong(target)
      .then(data => {
        if (!data) throw new Error("Could not load song");
        setSong(data);
        // Default to chords view if chords available and requested
        if (data.chords && data.chords.length > 0 && songSummary.chords) {
          setViewMode('chords');
        } else {
          setViewMode('lyrics');
        }
        setLoading(false);
      })
      .catch(err => {
        console.error("Error loading song:", err);
        setLoading(false);
      });
  }, [songSummary?.id, songSummary?.slug]);

  // Sync pin status
  useEffect(() => {
    const updatePinInfo = () => {
      const targetId = song?.id || songSummary?.id;
      const targetSlug = song?.slug || songSummary?.slug;
      setPinnedStatus(isSongPinned(targetId, targetSlug));
    };

    updatePinInfo();
    window.addEventListener('jhf_pinned_songs_changed', updatePinInfo);
    window.addEventListener('storage', updatePinInfo);
    return () => {
      window.removeEventListener('jhf_pinned_songs_changed', updatePinInfo);
      window.removeEventListener('storage', updatePinInfo);
    };
  }, [song?.id, songSummary?.id]);

  const handleTogglePin = () => {
    setPinActionError('');
    if (pinnedStatus.isPinned) {
      setPinNumberInput(String(pinnedStatus.pinNumber || 1));
    } else {
      setPinNumberInput('');
    }
    setShowPinPrompt(true);
  };

  const handleConfirmPin = async (e) => {
    if (e) e.preventDefault();
    if (!isAdmin) {
      setPinActionError('Administrator privileges required.');
      return;
    }

    const res = await pinSong(song || songSummary, pinNumberInput || null);
    if (!res.success) {
      setPinActionError(res.error || 'Failed to pin song in database');
      return;
    }
    setShowPinPrompt(false);
    setPinActionError('');
  };

  const handleUnpin = async () => {
    if (!isAdmin) {
      setPinActionError('Administrator privileges required.');
      return;
    }

    const res = await unpinSong(song?.id || songSummary?.id, song?.slug || songSummary?.slug);
    if (!res.success) {
      setPinActionError(res.error || 'Failed to unpin song in database');
      return;
    }
    setShowPinPrompt(false);
    setPinActionError('');
  };

  const handleCopy = () => {
    if (!song) return;
    let textToCopy = `${song.title} (${song.title_transliterated || ''})\n\n`;
    if (viewMode === 'chords' && song.chords) {
      const transposed = transposeChordSheet(song.chords, semitones);
      textToCopy += transposed.join('\n');
    } else {
      const originalLines = song.lyrics_original || [];
      textToCopy += originalLines.join('\n');
    }
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handlePptDownload = async (e) => {
    if (e) e.preventDefault();

    // If song has a pre-existing cloud PPT URL, open it directly
    if (song?.ppt_url) {
      window.open(song.ppt_url, '_blank');
      return;
    }

    try {
      setIsGeneratingPpt(true);
      let songData = song;
      if (!songData || !songData.lyrics_original) {
        const target = songSummary?.slug || songSummary?.id;
        if (target) {
          songData = await getSong(target);
        }
      }
      if (!songData) {
        throw new Error("Song details could not be loaded.");
      }
      await generateSongPptx(songData);
    } catch (err) {
      console.error('Failed to generate PowerPoint:', err);
      alert('Unable to generate PowerPoint slides. Please try again.');
    } finally {
      setIsGeneratingPpt(false);
    }
  };

  if (!songSummary) return null;

  return (
    <div id="song-detail-view" tabIndex={-1} className="bg-white dark:bg-slate-900 rounded-none sm:rounded-2xl border-0 sm:border border-slate-200/80 dark:border-slate-800 shadow-xl overflow-hidden flex flex-col h-full outline-none">
      
      {/* Mobile Top Navigation Bar */}
      <div className="sm:hidden px-3.5 py-2.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900 sticky top-0 z-20">
        <button
          onClick={onClose}
          className="px-3 py-1.5 text-slate-700 dark:text-slate-200 bg-slate-200/80 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 rounded-xl flex items-center gap-1.5 font-bold text-xs transition active:scale-95 shadow-xs"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Songs</span>
        </button>

        <div className="flex items-center gap-1">
          {/* Pin Song (Mobile) */}
          <button
            onClick={handleTogglePin}
            className={`p-2 rounded-xl transition flex items-center gap-1 ${
              pinnedStatus.isPinned
                ? 'bg-amber-500/20 text-amber-500 border border-amber-500/40 font-bold'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            title={pinnedStatus.isPinned ? `Pinned #${pinnedStatus.pinNumber}` : "Pin for Today's Service"}
          >
            <Pin className={`w-4 h-4 ${pinnedStatus.isPinned ? 'fill-amber-500 text-amber-500' : ''}`} />
            {pinnedStatus.isPinned && <span className="text-[11px] font-black">#{pinnedStatus.pinNumber}</span>}
          </button>

          {/* Presentation Mode */}
          <button
            onClick={() => onOpenPresentation(song)}
            className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title="Presentation Mode"
          >
            <Maximize2 className="w-4 h-4" />
          </button>

          {/* Copy Lyrics */}
          <button
            onClick={handleCopy}
            className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title="Copy"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
          </button>

          {/* Close button */}
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Song Header (Desktop + Mobile Body) */}
      <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-start justify-between gap-4 bg-slate-50/70 dark:bg-slate-900/70">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300">
              {song?.language || songSummary.lang}
            </span>

            {/* Pinned Badge */}
            {pinnedStatus.isPinned && (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-500 dark:text-amber-300 border border-amber-500/40 flex items-center gap-1.5 shadow-xs animate-fadeIn">
                <Pin className="w-3 h-3 fill-amber-500 text-amber-500" />
                <span>Today's Worship Service #{pinnedStatus.pinNumber || 1}</span>
              </span>
            )}

            {/* Songbook & Hymn Number */}
            {(() => {
              if (!song?.songbooks || song.songbooks.length === 0) return null;
              const b = song.songbooks[0];
              const name = typeof b === 'string' ? b : (b.book || b.title || b.name || '');
              if (!name) return null;
              const num = typeof b === 'object' ? b.number : null;
              return (
                <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-900 flex items-center gap-1">
                  <span>{name.replace(/-/g, ' ')}</span>
                  {num && <strong className="text-amber-600 dark:text-amber-400 font-bold">• Hymn #{num}</strong>}
                </span>
              );
            })()}
          </div>

          <h2 className="text-2xl sm:text-2xl font-extrabold text-slate-900 dark:text-white leading-tight">
            {song?.title || songSummary.t}
          </h2>

          {(song?.title_transliterated || songSummary.tr) && (
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
              {song?.title_transliterated || songSummary.tr}
            </p>
          )}

          {(song?.author_english || song?.author_telugu) && (
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 italic">
              Composer / Author: {song.author_english || song.author_telugu}
            </p>
          )}

          {/* Mobile Media Controls & PPT Bar */}
          <div className="sm:hidden flex items-center gap-2 mt-3 pt-3 border-t border-slate-200/50 dark:border-slate-800">
            {videoId && (
              <>
                <button
                  onClick={() => {
                    setShowVideo(prev => !prev);
                    if (onPlayMedia) onPlayMedia(song || songSummary);
                  }}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold rounded-xl transition ${
                    showVideo || activePlayingId === song?.id || activePlayingId === songSummary?.id
                      ? 'bg-rose-600 text-white shadow-md shadow-rose-500/20'
                      : 'bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-900/40'
                  }`}
                >
                  <Video className="w-4 h-4" />
                  <span>{showVideo ? 'Hide Video' : 'Audio / Video'}</span>
                </button>

                <a
                  href={`https://www.youtube.com/watch?v=${videoId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-xl text-rose-500 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/40 transition shrink-0"
                  title="Watch directly on YouTube"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </>
            )}

            {/* PPT Download (Auto-generated or Cloud Link) */}
            <button
              onClick={handlePptDownload}
              disabled={isGeneratingPpt}
              className={`p-2 rounded-xl text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900/40 transition shrink-0 flex items-center justify-center ${!videoId ? 'w-full py-2.5 gap-2 font-bold text-xs' : ''}`}
              title={song?.ppt_url ? "Download PowerPoint Presentation (Hosted)" : "Auto-Generate & Download PowerPoint (16:9 PPTX)"}
            >
              {isGeneratingPpt ? (
                <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              {!videoId && <span>{isGeneratingPpt ? 'Generating PowerPoint...' : 'Download PowerPoint (PPT)'}</span>}
            </button>
          </div>
        </div>

        {/* Desktop Action icons */}
        <div className="hidden sm:flex items-center gap-2 shrink-0">
          {/* Pin Song (Desktop) */}
          <button
            onClick={handleTogglePin}
            className={`p-2 rounded-xl transition flex items-center gap-1.5 ${
              pinnedStatus.isPinned
                ? 'bg-amber-500/20 text-amber-500 dark:text-amber-400 border border-amber-500/40 font-bold shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            title={
              pinnedStatus.isPinned
                ? `Pinned #${pinnedStatus.pinNumber} on Landing Page (Click to edit or unpin)`
                : (isAdmin ? "Pin song to Landing Page for Today's Service" : "Pinned Song Status")
            }
          >
            <Pin className={`w-4 h-4 ${pinnedStatus.isPinned ? 'fill-amber-500 text-amber-500' : ''}`} />
            {pinnedStatus.isPinned ? (
              <span className="text-xs font-bold">#{pinnedStatus.pinNumber} Pinned</span>
            ) : (
              isAdmin && <span className="text-xs font-medium text-slate-500 dark:text-slate-400 hidden xl:inline">Pin</span>
            )}
          </button>

          {/* Audio / Video Play Button */}
          {videoId && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  setShowVideo(prev => !prev);
                  if (onPlayMedia) onPlayMedia(song || songSummary);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl transition ${
                  showVideo || activePlayingId === song?.id || activePlayingId === songSummary?.id
                    ? 'bg-rose-600 text-white shadow-md shadow-rose-500/20'
                    : 'bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/60'
                }`}
              >
                <Video className="w-3.5 h-3.5" />
                <span>{showVideo ? 'Hide Video' : 'Audio / Video'}</span>
              </button>

              <a
                href={`https://www.youtube.com/watch?v=${videoId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition"
                title="Watch directly on YouTube"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          )}

          {/* Presentation Mode */}
          <button
            onClick={() => onOpenPresentation(song)}
            className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title="Church Presentation / Fullscreen Mode"
          >
            <Maximize2 className="w-4 h-4" />
          </button>

          {/* PPT Download */}
          <button
            onClick={handlePptDownload}
            disabled={isGeneratingPpt}
            className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title={song?.ppt_url ? "Download PowerPoint (PPT)" : "Auto-Generate & Download PowerPoint (16:9 PPTX)"}
          >
            {isGeneratingPpt ? (
              <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
            ) : (
              <Download className="w-4 h-4" />
            )}
          </button>

          {/* Copy Lyrics */}
          <button
            onClick={handleCopy}
            className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title="Copy to Clipboard"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
          </button>

          {/* Close button */}
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Control Toolbar: Mode tabs, Chord transposer, Font zoom */}
      <div className="px-4 sm:px-6 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4 flex-wrap bg-white dark:bg-slate-900 text-xs">
        
        {/* Left: View & Script Switchers */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Lyrics vs Chords view */}
          {song?.chords && song.chords.length > 0 && (
            <div className="flex items-center p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg">
              <button
                onClick={() => setViewMode('lyrics')}
                className={`px-3 py-1 rounded-md font-semibold transition ${
                  viewMode === 'lyrics'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Lyrics
              </button>
              <button
                onClick={() => setViewMode('chords')}
                className={`flex items-center gap-1 px-3 py-1 rounded-md font-semibold transition ${
                  viewMode === 'chords'
                    ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <Guitar className="w-3.5 h-3.5" />
                <span>Chords ({song.chord_count || song.chords.length})</span>
              </button>
            </div>
          )}

          {/* Script Mode (Original / English / Dual) */}
          {viewMode === 'lyrics' && (
            <div className="flex items-center p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg">
              <button
                onClick={() => setScriptMode('original')}
                className={`px-2.5 py-1 rounded-md font-medium transition ${
                  scriptMode === 'original'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Original
              </button>
              <button
                onClick={() => setScriptMode('transliterated')}
                className={`px-2.5 py-1 rounded-md font-medium transition ${
                  scriptMode === 'transliterated'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                English
              </button>
              <button
                onClick={() => setScriptMode('dual')}
                className={`px-2.5 py-1 rounded-md font-medium transition ${
                  scriptMode === 'dual'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Dual View
              </button>
            </div>
          )}
        </div>

        {/* Right: Chord Transposer & Font Controls */}
        <div className="flex items-center gap-3 flex-wrap">
          
          {/* Chord Transpose Controls (if in chords mode) */}
          {viewMode === 'chords' && (
            <div className="flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 rounded-lg border border-amber-200/60 dark:border-amber-900/60 text-amber-900 dark:text-amber-200">
              <span className="font-semibold mr-1">Transpose:</span>
              <button
                onClick={() => setSemitones(s => s - 1)}
                className="w-5 h-5 rounded flex items-center justify-center bg-white dark:bg-slate-800 font-bold hover:bg-amber-100 dark:hover:bg-amber-900 transition"
                title="Transpose Down 1 Semitone"
              >
                -
              </button>
              <span className="font-mono font-bold min-w-[28px] text-center">
                {semitones > 0 ? `+${semitones}` : semitones}
              </span>
              <button
                onClick={() => setSemitones(s => s + 1)}
                className="w-5 h-5 rounded flex items-center justify-center bg-white dark:bg-slate-800 font-bold hover:bg-amber-100 dark:hover:bg-amber-900 transition"
                title="Transpose Up 1 Semitone"
              >
                +
              </button>
              {semitones !== 0 && (
                <button
                  onClick={() => setSemitones(0)}
                  className="p-1 hover:text-amber-600 dark:hover:text-amber-400 ml-1"
                  title="Reset to Original Key"
                >
                  <RotateCcw className="w-3 h-3" />
                </button>
              )}
            </div>
          )}

          {/* Font Size Zoom Controls */}
          <div className="flex items-center gap-1 text-slate-500">
            <button
              onClick={() => setFontSize(s => Math.max(12, s - 2))}
              className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Decrease Font Size"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] font-mono">{fontSize}px</span>
            <button
              onClick={() => setFontSize(s => Math.min(32, s + 2))}
              className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Increase Font Size"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

        </div>
      </div>

      {/* In-Page YouTube Video Player */}
      {showVideo && videoId && (
        <div className="px-6 py-4 bg-slate-900 border-b border-slate-800 shrink-0">
          <div className="relative aspect-video w-full max-w-2xl mx-auto rounded-xl overflow-hidden shadow-2xl bg-black ring-1 ring-white/10">
            <iframe
              src={`https://www.youtube.com/embed/${videoId}?autoplay=1&enablejsapi=1&rel=0`}
              title={song?.title || songSummary?.t}
              className="w-full h-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        </div>
      )}

      {/* Main Lyrics / Chords Content Area */}
      <div className="flex-1 p-4 sm:p-8 pb-36 sm:pb-12 overflow-y-auto" style={{ fontSize: `${fontSize}px` }}>
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <div className="w-8 h-8 border-3 border-brand-500 border-t-transparent rounded-full animate-spin mb-3"></div>
            <p className="text-sm font-medium">Loading song stanzas...</p>
          </div>
        ) : viewMode === 'chords' && song?.chords ? (
          /* Chords View */
          <div className="space-y-1 font-mono">
            {transposeChordSheet(song.chords, semitones).map((line, idx) => {
              const chordLine = isChordLine(line);
              return (
                <div
                  key={idx}
                  className={`whitespace-pre select-text ${
                    chordLine
                      ? 'chord-line font-bold text-brand-600 dark:text-brand-400 mt-3 pt-1 text-[1.05em]'
                      : 'text-slate-800 dark:text-slate-200 leading-relaxed font-sans'
                  }`}
                >
                  {line || '\u00A0'}
                </div>
              );
            })}
            {song.chord_credits && (
              <p className="text-xs text-slate-400 italic pt-6">
                Chords Credit: {song.chord_credits}
              </p>
            )}
          </div>
        ) : (
          /* Lyrics View */
          <div className="space-y-6">
            {scriptMode === 'dual' ? (
              /* Dual Side-by-Side View */
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 divide-y md:divide-y-0 md:divide-x divide-slate-100 dark:divide-slate-800">
                {/* Original Script */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Original Script</h4>
                  <div className="telugu-text text-slate-800 dark:text-slate-100 whitespace-pre-line leading-loose">
                    {(song?.lyrics_original || []).join('\n')}
                  </div>
                </div>
                {/* English Transliterated */}
                <div className="space-y-4 md:pl-8 pt-6 md:pt-0">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">English Transliteration</h4>
                  <div className="text-slate-700 dark:text-slate-200 whitespace-pre-line leading-loose font-sans">
                    {(song?.lyrics_transliterated || []).join('\n') || (
                      <span className="text-slate-400 italic text-sm">Transliteration not available.</span>
                    )}
                  </div>
                </div>
              </div>
            ) : scriptMode === 'transliterated' ? (
              /* English Transliterated */
              <div className="text-slate-800 dark:text-slate-100 whitespace-pre-line leading-loose font-sans">
                {(song?.lyrics_transliterated || []).join('\n') || (song?.lyrics_original || []).join('\n')}
              </div>
            ) : (
              /* Original Script */
              <div className="telugu-text text-slate-800 dark:text-slate-100 whitespace-pre-line leading-loose">
                {(song?.lyrics_original || []).join('\n')}
              </div>
            )}
          </div>
        )}

        {/* Bible Verses Section */}
        {song?.bible_verses && song.bible_verses.length > 0 && (
          <div className="mt-12 pt-6 border-t border-slate-100 dark:border-slate-800">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5" />
              <span>Related Scripture</span>
            </h4>
            <div className="space-y-3">
              {song.bible_verses.map((v, i) => (
                <div key={i} className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/50 dark:border-slate-700 text-xs">
                  <strong className="text-brand-600 dark:text-brand-400 block mb-1">{v.reference}</strong>
                  <p className="text-slate-700 dark:text-slate-300 italic">{v.telugu || v.english || v.hindi}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Pin Order & Admin Unlock Prompt Modal */}
      {showPinPrompt && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-fadeIn">
          <div
            className="w-full max-w-sm bg-slate-900 border border-amber-500/40 rounded-3xl p-6 shadow-2xl text-slate-100 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold">
                {!isAdmin ? <Lock className="w-5 h-5 text-slate-950" /> : <Pin className="w-5 h-5 fill-slate-950" />}
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  {!isAdmin 
                    ? "Admin Privileges Required" 
                    : (pinnedStatus.isPinned ? "Update Pinned Song" : "Pin to Landing Page")}
                </h3>
                <p className="text-xs text-slate-400">Featured Today's Service Song</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 mb-4 leading-relaxed">
              {!isAdmin 
                ? "Pinned songs can only be modified by church administrators. Legacy password access has been decommissioned." 
                : "Pinned songs are highlighted right at the top of the church landing page with their order numbers (#1, #2, #3...)."}
            </p>

            {pinActionError && (
              <div className="mb-4 p-3 bg-red-950/60 border border-red-500/40 rounded-xl flex items-center gap-2 text-xs text-red-300">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                <span>{pinActionError}</span>
              </div>
            )}

            {!isAdmin ? (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowPinPrompt(false);
                    setPinActionError('');
                  }}
                  className="w-full py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition"
                >
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={handleConfirmPin} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-amber-400 uppercase tracking-wider mb-1.5">
                    Pin / Worship Order Number
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={pinNumberInput}
                    onChange={(e) => setPinNumberInput(e.target.value)}
                    placeholder="e.g. 1 (Leave empty for next available)"
                    autoFocus
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500 placeholder-slate-500"
                  />
                </div>

                <div className="flex items-center gap-2 pt-2">
                  {pinnedStatus.isPinned && (
                    <button
                      type="button"
                      onClick={handleUnpin}
                      className="py-2.5 px-3 bg-rose-950/60 hover:bg-rose-900 border border-rose-500/40 text-rose-300 rounded-xl text-xs font-bold transition flex items-center gap-1"
                    >
                      <PinOff className="w-3.5 h-3.5" />
                      <span>Unpin</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setShowPinPrompt(false);
                      setPinActionError('');
                    }}
                    className="flex-1 py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="flex-1 py-2.5 px-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition shadow-lg shadow-amber-500/20 flex items-center justify-center gap-1"
                  >
                    {pinnedStatus.isPinned ? "Save Number" : "Pin Song 📌"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
