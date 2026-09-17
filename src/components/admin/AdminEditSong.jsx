import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ArrowLeft,
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
  Music,
  Video,
  FileText,
  BookOpen,
  Sparkles,
  Plus,
  Trash2,
  HelpCircle,
  Eye,
  EyeOff,
  Globe,
  Tag,
  RefreshCw,
  Clock,
  KeyRound
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  getAdminSong,
  updateSong,
  slugify,
  deriveAlphabet,
  normalizeLyricsArray,
  checkSlugAvailability,
  fetchAvailableCategories,
  formatAdminError,
  EDITABLE_SONG_COLUMNS
} from '../../services/adminSongService';
import AdminSongbookManager from './AdminSongbookManager';

function extractYoutubeId(input) {
  if (!input) return '';
  const trimmed = input.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  const match = trimmed.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
  return match ? match[1] : trimmed;
}

function formatDate(isoString) {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (_) {
    return '—';
  }
}

/**
 * AdminEditSong Component
 * 
 * Provides production-grade hymn editing for authenticated administrators.
 * Modifies permitted fields of an existing song in public.songs under PostgreSQL RLS.
 * 
 * Strict Schema & Field Policy:
 * - Editable: slug, title, title_transliterated, language, alphabet, lyrics_original,
 *   lyrics_transliterated, youtube_id, chords, chord_count, chord_credits, author_english,
 *   author_telugu, category_names, ppt_url, bible_verses, devotional, is_published.
 * - Protected / Immutable: id, created_at, updated_at, songbooks.
 * - Zero writes to songbook_songs (Rule 21: deferred to Phase 9B-6).
 * - Zero writes to pinned_songs (Rule 20: pinned safety).
 */
export default function AdminEditSong({ songId, onBackToList, onSuccess }) {
  const { session, user, profile, loading: authLoading } = useAuth();

  // Load States
  const [isLoadingSong, setIsLoadingSong] = useState(true);
  const [songLoadError, setSongLoadError] = useState(null);
  const [loadedSong, setLoadedSong] = useState(null);
  const [initialSnapshot, setInitialSnapshot] = useState(null);

  // Form Field States
  const [title, setTitle] = useState('');
  const [titleTransliterated, setTitleTransliterated] = useState('');
  const [slug, setSlug] = useState('');
  const [language, setLanguage] = useState('telugu');
  const [alphabet, setAlphabet] = useState('A');
  const [lyricsOriginalText, setLyricsOriginalText] = useState('');
  const [lyricsTransliteratedText, setLyricsTransliteratedText] = useState('');
  const [authorTelugu, setAuthorTelugu] = useState('');
  const [authorEnglish, setAuthorEnglish] = useState('');
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [youtubeInput, setYoutubeInput] = useState('');
  const [pptUrl, setPptUrl] = useState('');
  const [chordsText, setChordsText] = useState('');
  const [chordCredits, setChordCredits] = useState('');
  const [bibleVerses, setBibleVerses] = useState([]);
  const [showDevotional, setShowDevotional] = useState(false);
  const [devotional, setDevotional] = useState({
    reflection_english: '',
    reflection_telugu: '',
    prayer_english: '',
    prayer_telugu: ''
  });
  const [isPublished, setIsPublished] = useState(true);

  // Category Metadata State
  const [availableCategories, setAvailableCategories] = useState([]);
  const [categoryLoadError, setCategoryLoadError] = useState(null);

  // Slug Verification State
  const [slugChecking, setSlugChecking] = useState(false);
  const [slugAvailable, setSlugAvailable] = useState(null);
  const [slugCheckMessage, setSlugCheckMessage] = useState('');

  // Mutation & Feedback State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [saveSuccessNotice, setSaveSuccessNotice] = useState(null);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);

  // 1. Fetch song record and categories
  const loadSongData = useCallback(async () => {
    if (!songId) return;
    setIsLoadingSong(true);
    setSongLoadError(null);
    setSaveSuccessNotice(null);
    setSubmitError(null);

    try {
      // Fetch song and categories in parallel
      const [songRes, catRes] = await Promise.all([
        getAdminSong(songId),
        fetchAvailableCategories()
      ]);

      if (songRes.error || !songRes.song) {
        setSongLoadError(songRes.error || 'Song record could not be loaded.');
        setIsLoadingSong(false);
        return;
      }

      if (catRes.error) {
        setCategoryLoadError(catRes.error);
      } else {
        setAvailableCategories(catRes.categories || []);
      }

      const song = songRes.song;
      setLoadedSong(song);

      // Populate form state
      const initialTitle = song.title || '';
      const initialTranslit = song.title_transliterated || '';
      const initialSlug = song.slug || '';
      const initialLang = song.language || 'telugu';
      const initialAlpha = song.alphabet || 'A';
      const initialLyricsOrig = Array.isArray(song.lyrics_original) ? song.lyrics_original.join('\n') : '';
      const initialLyricsTrans = Array.isArray(song.lyrics_transliterated) ? song.lyrics_transliterated.join('\n') : '';
      const initialAuthTel = song.author_telugu || '';
      const initialAuthEng = song.author_english || '';
      const initialCats = Array.isArray(song.category_names) ? [...song.category_names] : [];
      const initialYt = song.youtube_id || '';
      const initialPpt = song.ppt_url || '';
      const initialChords = Array.isArray(song.chords) ? song.chords.join('\n') : '';
      const initialCredits = song.chord_credits || '';
      const initialVerses = Array.isArray(song.bible_verses) ? JSON.parse(JSON.stringify(song.bible_verses)) : [];
      const hasDevotional = Boolean(song.devotional && Object.keys(song.devotional).length > 0);
      const initialDevo = song.devotional
        ? {
            reflection_english: song.devotional.reflection_english || '',
            reflection_telugu: song.devotional.reflection_telugu || '',
            prayer_english: song.devotional.prayer_english || '',
            prayer_telugu: song.devotional.prayer_telugu || ''
          }
        : {
            reflection_english: '',
            reflection_telugu: '',
            prayer_english: '',
            prayer_telugu: ''
          };
      const initialPub = song.is_published ?? true;

      setTitle(initialTitle);
      setTitleTransliterated(initialTranslit);
      setSlug(initialSlug);
      setLanguage(initialLang);
      setAlphabet(initialAlpha);
      setLyricsOriginalText(initialLyricsOrig);
      setLyricsTransliteratedText(initialLyricsTrans);
      setAuthorTelugu(initialAuthTel);
      setAuthorEnglish(initialAuthEng);
      setSelectedCategories(initialCats);
      setYoutubeInput(initialYt);
      setPptUrl(initialPpt);
      setChordsText(initialChords);
      setChordCredits(initialCredits);
      setBibleVerses(initialVerses);
      setShowDevotional(hasDevotional);
      setDevotional(initialDevo);
      setIsPublished(initialPub);

      // Snapshot for dirty state tracking
      setInitialSnapshot({
        title: initialTitle,
        titleTransliterated: initialTranslit,
        slug: initialSlug,
        language: initialLang,
        alphabet: initialAlpha,
        lyricsOriginalText: initialLyricsOrig,
        lyricsTransliteratedText: initialLyricsTrans,
        authorTelugu: initialAuthTel,
        authorEnglish: initialAuthEng,
        selectedCategories: JSON.stringify(initialCats),
        youtubeInput: initialYt,
        pptUrl: initialPpt,
        chordsText: initialChords,
        chordCredits: initialCredits,
        bibleVerses: JSON.stringify(initialVerses),
        showDevotional: hasDevotional,
        devotional: JSON.stringify(initialDevo),
        isPublished: initialPub
      });
    } catch (err) {
      setSongLoadError(formatAdminError(err));
    } finally {
      setIsLoadingSong(false);
    }
  }, [songId]);

  useEffect(() => {
    loadSongData();
  }, [loadSongData]);

  // Compute dirty (unsaved changes) state
  const isDirty = useMemo(() => {
    if (!initialSnapshot) return false;
    return (
      title !== initialSnapshot.title ||
      titleTransliterated !== initialSnapshot.titleTransliterated ||
      slug !== initialSnapshot.slug ||
      language !== initialSnapshot.language ||
      alphabet !== initialSnapshot.alphabet ||
      lyricsOriginalText !== initialSnapshot.lyricsOriginalText ||
      lyricsTransliteratedText !== initialSnapshot.lyricsTransliteratedText ||
      authorTelugu !== initialSnapshot.authorTelugu ||
      authorEnglish !== initialSnapshot.authorEnglish ||
      JSON.stringify(selectedCategories) !== initialSnapshot.selectedCategories ||
      youtubeInput !== initialSnapshot.youtubeInput ||
      pptUrl !== initialSnapshot.pptUrl ||
      chordsText !== initialSnapshot.chordsText ||
      chordCredits !== initialSnapshot.chordCredits ||
      JSON.stringify(bibleVerses) !== initialSnapshot.bibleVerses ||
      showDevotional !== initialSnapshot.showDevotional ||
      JSON.stringify(devotional) !== initialSnapshot.devotional ||
      isPublished !== initialSnapshot.isPublished
    );
  }, [
    initialSnapshot,
    title,
    titleTransliterated,
    slug,
    language,
    alphabet,
    lyricsOriginalText,
    lyricsTransliteratedText,
    authorTelugu,
    authorEnglish,
    selectedCategories,
    youtubeInput,
    pptUrl,
    chordsText,
    chordCredits,
    bibleVerses,
    showDevotional,
    devotional,
    isPublished
  ]);

  // Debounced slug uniqueness verification if slug changed from original
  useEffect(() => {
    if (!slug) {
      setSlugAvailable(null);
      setSlugCheckMessage('');
      return;
    }

    if (loadedSong && slug === loadedSong.slug) {
      setSlugAvailable(true);
      setSlugCheckMessage('Current song slug');
      return;
    }

    const timer = setTimeout(async () => {
      setSlugChecking(true);
      const res = await checkSlugAvailability(slug);
      setSlugChecking(false);
      if (res.error) {
        setSlugAvailable(null);
        setSlugCheckMessage('');
      } else if (res.available) {
        setSlugAvailable(true);
        setSlugCheckMessage('New slug is available');
      } else {
        setSlugAvailable(false);
        setSlugCheckMessage('A song with this slug already exists');
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [slug, loadedSong]);

  // Category toggle helper
  const toggleCategory = (catName) => {
    setSelectedCategories((prev) =>
      prev.includes(catName) ? prev.filter((c) => c !== catName) : [...prev, catName]
    );
  };

  // Bible verse row helpers
  const addBibleVerse = () => {
    setBibleVerses((prev) => [...prev, { reference: '', english: '', telugu: '' }]);
  };

  const updateBibleVerse = (index, field, value) => {
    setBibleVerses((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const removeBibleVerse = (index) => {
    setBibleVerses((prev) => prev.filter((_, i) => i !== index));
  };

  // Back Navigation with Unsaved Changes Guard
  const handleBackClick = () => {
    if (isDirty) {
      setShowUnsavedModal(true);
    } else if (onBackToList) {
      onBackToList();
    }
  };

  // Form Submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!loadedSong) return;

    setSubmitError(null);
    setSaveSuccessNotice(null);

    // 1. Basic validation
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setSubmitError('Song title is required.');
      return;
    }

    const cleanSlug = slugify(slug || cleanTitle);
    if (!cleanSlug) {
      setSubmitError('A valid URL slug is required.');
      return;
    }

    // 2. Lyrics normalization & stanza validation
    const rawLyricsOriginal = normalizeLyricsArray(lyricsOriginalText);
    const nonBlankLyrics = rawLyricsOriginal.filter((l) => l.trim().length > 0);
    if (nonBlankLyrics.length === 0) {
      setSubmitError('Original lyrics are required and must contain at least one non-empty line.');
      return;
    }

    // 3. PPT URL validation
    if (pptUrl.trim()) {
      const p = pptUrl.trim();
      if (!p.startsWith('http://') && !p.startsWith('https://')) {
        setSubmitError('PowerPoint presentation URL must begin with http:// or https://.');
        return;
      }
    }

    // 4. Chords parsing
    const chordsLines = chordsText.trim() ? normalizeLyricsArray(chordsText) : [];
    const chordsArray = chordsLines.length > 0 ? chordsLines : null;
    const calculatedChordCount = chordsArray
      ? chordsArray.filter((l) => l.trim().length > 0).length
      : 0;

    // 5. Bible verses & Devotional structure
    const validBibleVerses = bibleVerses
      .filter((v) => v.reference && v.reference.trim())
      .map((v) => ({
        reference: v.reference.trim(),
        english: (v.english || '').trim(),
        telugu: (v.telugu || '').trim()
      }));

    let devotionalPayload = null;
    if (showDevotional) {
      devotionalPayload = {
        reflection_english: (devotional.reflection_english || '').trim() || null,
        reflection_telugu: (devotional.reflection_telugu || '').trim() || null,
        prayer_english: (devotional.prayer_english || '').trim() || null,
        prayer_telugu: (devotional.prayer_telugu || '').trim() || null
      };
    }

    // 6. Build strictly whitelisted update payload
    // NEVER include id, created_at, updated_at, or songbooks!
    const payload = {
      title: cleanTitle,
      title_transliterated: titleTransliterated.trim() || null,
      slug: cleanSlug,
      language: language.toLowerCase().trim(),
      alphabet: (alphabet || deriveAlphabet(cleanTitle, language)).trim(),
      lyrics_original: rawLyricsOriginal,
      lyrics_transliterated: lyricsTransliteratedText.trim()
        ? normalizeLyricsArray(lyricsTransliteratedText)
        : [],
      youtube_id: extractYoutubeId(youtubeInput) || null,
      chords: chordsArray,
      chord_count: calculatedChordCount,
      chord_credits: chordCredits.trim() || null,
      author_english: authorEnglish.trim() || null,
      author_telugu: authorTelugu.trim() || null,
      category_names: selectedCategories,
      ppt_url: pptUrl.trim() || null,
      bible_verses: validBibleVerses,
      devotional: devotionalPayload,
      is_published: Boolean(isPublished)
    };

    // 7. Execute updateSong under PostgreSQL RLS
    setIsSubmitting(true);
    try {
      const result = await updateSong(loadedSong.id, payload);
      if (!result.success) {
        setSubmitError(result.error || 'Failed to update song.');
      } else {
        const updated = result.song;
        setLoadedSong(updated);

        // Refresh snapshot to clear dirty state
        setInitialSnapshot({
          title: updated.title || '',
          titleTransliterated: updated.title_transliterated || '',
          slug: updated.slug || '',
          language: updated.language || 'telugu',
          alphabet: updated.alphabet || 'A',
          lyricsOriginalText: Array.isArray(updated.lyrics_original) ? updated.lyrics_original.join('\n') : '',
          lyricsTransliteratedText: Array.isArray(updated.lyrics_transliterated) ? updated.lyrics_transliterated.join('\n') : '',
          authorTelugu: updated.author_telugu || '',
          authorEnglish: updated.author_english || '',
          selectedCategories: JSON.stringify(Array.isArray(updated.category_names) ? updated.category_names : []),
          youtubeInput: updated.youtube_id || '',
          pptUrl: updated.ppt_url || '',
          chordsText: Array.isArray(updated.chords) ? updated.chords.join('\n') : '',
          chordCredits: updated.chord_credits || '',
          bibleVerses: JSON.stringify(Array.isArray(updated.bible_verses) ? updated.bible_verses : []),
          showDevotional: Boolean(updated.devotional && Object.keys(updated.devotional).length > 0),
          devotional: JSON.stringify(
            updated.devotional || { reflection_english: '', reflection_telugu: '', prayer_english: '', prayer_telugu: '' }
          ),
          isPublished: updated.is_published ?? true
        });

        setSaveSuccessNotice({
          message: 'Song updated successfully.',
          timestamp: new Date().toLocaleTimeString(),
          song: updated
        });

        if (onSuccess) {
          onSuccess(updated);
        }
      }
    } catch (err) {
      setSubmitError(formatAdminError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Auth Gates ---
  if (authLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-slate-300">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin mb-4" />
        <p className="text-sm font-medium">Verifying administrator session...</p>
      </div>
    );
  }

  if (!session || !user) {
    return (
      <div className="max-w-2xl mx-auto my-12 p-8 bg-slate-900/90 border border-slate-800 rounded-3xl text-center shadow-xl backdrop-blur-md">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-100 mb-2">Administrator Access Required</h2>
        <p className="text-sm text-slate-400 mb-6 leading-relaxed">
          Editing hymnal records requires an authenticated administrator session.
          Please sign in with authorized ministry credentials.
        </p>
        <button
          onClick={onBackToList}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Song List</span>
        </button>
      </div>
    );
  }

  if (profile?.role !== 'admin') {
    return (
      <div className="max-w-2xl mx-auto my-12 p-8 bg-slate-900/90 border border-rose-500/30 rounded-3xl text-center shadow-xl backdrop-blur-md">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-100 mb-2">Permission Denied</h2>
        <p className="text-sm text-slate-400 mb-6 leading-relaxed">
          Your account (<span className="text-slate-200 font-medium">{user.email}</span>) does not have
          administrator privileges to edit catalog songs.
        </p>
        <button
          onClick={onBackToList}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Song List</span>
        </button>
      </div>
    );
  }

  // --- Song Loading State ---
  if (isLoadingSong) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-slate-300">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin mb-4" />
        <p className="text-sm font-medium">Loading hymn details from database...</p>
      </div>
    );
  }

  // --- Song Load Error State ---
  if (songLoadError || !loadedSong) {
    return (
      <div className="max-w-2xl mx-auto my-12 p-8 bg-slate-900/90 border border-rose-500/40 rounded-3xl text-center shadow-xl">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-100 mb-2">Unable to Load Song</h2>
        <p className="text-sm text-slate-400 mb-6">{songLoadError || 'Song record could not be found.'}</p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={loadSongData}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Retry Loading</span>
          </button>
          <button
            onClick={onBackToList}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Song List</span>
          </button>
        </div>
      </div>
    );
  }

  // Stanza Metrics
  const lyricsLines = normalizeLyricsArray(lyricsOriginalText);
  const nonEmptyLinesCount = lyricsLines.filter((l) => l.trim().length > 0).length;
  const stanzaCount = lyricsLines.filter((l) => l === '').length + (nonEmptyLinesCount > 0 ? 1 : 0);

  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-8 text-slate-100 animate-fadeIn">
      {/* Top Header & Metadata */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleBackClick}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
              title="Return to list"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-100 truncate max-w-xl">
              Edit Hymn: <span className="text-amber-400">{loadedSong.title}</span>
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
              Admin RLS
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 pl-9">
            Modify song details in <span className="font-mono text-slate-300">public.songs</span>. PostgreSQL Row Level Security is the authoritative boundary.
          </p>
        </div>

        <div className="flex items-center gap-2 pl-9 sm:pl-0">
          <button
            type="button"
            onClick={handleBackClick}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-md shadow-amber-500/10 transition-all disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Saving Changes...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save Changes</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Success Notice Banner */}
      {saveSuccessNotice && (
        <div className="flex items-center justify-between p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs sm:text-sm animate-fadeIn">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-400" />
            <div>
              <span className="font-semibold">{saveSuccessNotice.message}</span>
              <span className="text-emerald-400/80 ml-2">Saved at {saveSuccessNotice.timestamp}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onBackToList && onBackToList()}
              className="px-3 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border border-emerald-500/40 text-xs font-medium transition-colors"
            >
              Back to Song List
            </button>
            <button
              onClick={() => setSaveSuccessNotice(null)}
              className="p-1 text-emerald-400 hover:text-emerald-200"
            >
              &times;
            </button>
          </div>
        </div>
      )}

      {/* Error Notice Banner */}
      {submitError && (
        <div className="flex items-center justify-between p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs sm:text-sm animate-fadeIn">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-400" />
            <span>{submitError}</span>
          </div>
          <button
            onClick={() => setSubmitError(null)}
            className="p-1 text-rose-400 hover:text-rose-200"
          >
            &times;
          </button>
        </div>
      )}

      {/* Immutable / Protected Record Overview Card */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-2xl bg-slate-900/50 border border-slate-800 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-slate-500 flex-shrink-0" />
          <div className="min-w-0">
            <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Record UUID (Immutable)</div>
            <div className="font-mono text-slate-300 truncate text-[11px]">{loadedSong.id}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-slate-500 flex-shrink-0" />
          <div className="min-w-0">
            <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Timestamps (DB-Managed)</div>
            <div className="text-slate-300 text-[11px] truncate">
              Updated: {formatDate(loadedSong.updated_at)}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-purple-400 flex-shrink-0" />
          <div className="min-w-0">
            <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Songbooks (Protected)</div>
            <div className="text-purple-300 text-[11px] truncate">
              {Array.isArray(loadedSong.songbooks) && loadedSong.songbooks.length > 0
                ? `${loadedSong.songbooks.length} book(s) assigned (Preserved)`
                : 'No songbooks assigned (Preserved)'}
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* SECTION A: Basic Information */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-md backdrop-blur-sm">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-800/80 text-amber-400 font-semibold text-sm sm:text-base">
            <Globe className="w-4 h-4" />
            <span>A. Basic Information</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-xs sm:text-sm">
            {/* Song Title */}
            <div className="space-y-1.5 sm:col-span-2">
              <label className="block font-medium text-slate-300">
                Song Title (Primary Script) <span className="text-amber-400">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. లేచినాడురా సమాధి గెలిచినాడురా or Amazing Grace"
                required
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700/80 focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/50 text-slate-100 placeholder:text-slate-500 outline-none"
              />
            </div>

            {/* Transliterated Title */}
            <div className="space-y-1.5">
              <label className="block font-medium text-slate-300">
                Transliterated Title (English Script)
              </label>
              <input
                type="text"
                value={titleTransliterated}
                onChange={(e) => setTitleTransliterated(e.target.value)}
                placeholder="e.g. Lechinaaduraa Samaadhi Gelichinaaduraa"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700/80 focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/50 text-slate-100 placeholder:text-slate-500 outline-none"
              />
            </div>

            {/* URL Slug */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block font-medium text-slate-300">
                  URL Slug <span className="text-amber-400">*</span>
                </label>
                {slug !== loadedSong.slug && (
                  <button
                    type="button"
                    onClick={() => setSlug(loadedSong.slug)}
                    className="text-[11px] text-amber-400 hover:text-amber-300 underline"
                  >
                    Reset to original
                  </button>
                )}
              </div>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(slugify(e.target.value))}
                placeholder="e.g. lechinaaduraa-samaadhi-gelichinaaduraa"
                required
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700/80 focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/50 text-slate-100 placeholder:text-slate-500 outline-none font-mono text-xs"
              />
              {/* Slug Validation Feedback */}
              <div className="flex items-center gap-1.5 text-[11px] pt-0.5">
                {slugChecking ? (
                  <span className="text-slate-400 flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
                    Checking slug...
                  </span>
                ) : slugAvailable === true ? (
                  <span className="text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    {slugCheckMessage}
                  </span>
                ) : slugAvailable === false ? (
                  <span className="text-rose-400 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {slugCheckMessage}
                  </span>
                ) : (
                  <span className="text-slate-500">Database UNIQUE constraint is the final authority.</span>
                )}
              </div>
            </div>

            {/* Language */}
            <div className="space-y-1.5">
              <label className="block font-medium text-slate-300">
                Language <span className="text-amber-400">*</span>
              </label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700/80 focus:border-amber-500/60 text-slate-100 outline-none"
              >
                <option value="telugu">Telugu (తెలుగు)</option>
                <option value="english">English</option>
                <option value="hindi">Hindi (हिन्दी)</option>
              </select>
            </div>

            {/* Alphabet */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block font-medium text-slate-300">
                  Indexing Alphabet <span className="text-amber-400">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setAlphabet(deriveAlphabet(title, language))}
                  className="text-[11px] text-amber-400 hover:text-amber-300 underline"
                >
                  Auto-derive
                </button>
              </div>
              <input
                type="text"
                value={alphabet}
                onChange={(e) => setAlphabet(e.target.value)}
                maxLength={4}
                required
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700/80 focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/50 text-slate-100 outline-none font-bold"
              />
            </div>
          </div>
        </div>

        {/* SECTION B: Lyrics */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-md backdrop-blur-sm">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
            <div className="flex items-center gap-2.5 text-amber-400 font-semibold text-sm sm:text-base">
              <FileText className="w-4 h-4" />
              <span>B. Lyrics & Stanzas</span>
            </div>
            <div className="text-[11px] text-slate-400 flex items-center gap-3">
              <span>Lines: <strong className="text-slate-200">{nonEmptyLinesCount}</strong></span>
              <span>Stanzas: <strong className="text-slate-200">{stanzaCount}</strong></span>
            </div>
          </div>

          <div className="space-y-5 text-xs sm:text-sm">
            {/* Original Lyrics */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block font-medium text-slate-300">
                  Original Lyrics (Primary Script) <span className="text-amber-400">*</span>
                </label>
                <span className="text-[11px] text-slate-400">
                  Tip: Separate stanzas with a blank line
                </span>
              </div>
              <textarea
                value={lyricsOriginalText}
                onChange={(e) => setLyricsOriginalText(e.target.value)}
                rows={12}
                placeholder="Enter lyrics lines here...&#10;&#10;Leave a blank line between stanzas to preserve stanza separators."
                required
                className="w-full px-4 py-3 rounded-2xl bg-slate-950/90 border border-slate-700/80 focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/50 text-slate-100 placeholder:text-slate-600 outline-none font-sans leading-relaxed text-sm"
              />
            </div>

            {/* Transliterated Lyrics */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block font-medium text-slate-300">
                  Transliterated Lyrics (English Script)
                </label>
                <span className="text-[11px] text-slate-400">Optional</span>
              </div>
              <textarea
                value={lyricsTransliteratedText}
                onChange={(e) => setLyricsTransliteratedText(e.target.value)}
                rows={8}
                placeholder="Enter transliterated lyrics lines here..."
                className="w-full px-4 py-3 rounded-2xl bg-slate-950/90 border border-slate-700/80 focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/50 text-slate-100 placeholder:text-slate-600 outline-none font-sans leading-relaxed text-sm"
              />
            </div>
          </div>
        </div>

        {/* SECTION C: Authors */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-md backdrop-blur-sm">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-800/80 text-amber-400 font-semibold text-sm sm:text-base">
            <Sparkles className="w-4 h-4" />
            <span>C. Songwriters & Credits</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-xs sm:text-sm">
            <div className="space-y-1.5">
              <label className="block font-medium text-slate-300">
                Author / Songwriter (Telugu Script)
              </label>
              <input
                type="text"
                value={authorTelugu}
                onChange={(e) => setAuthorTelugu(e.target.value)}
                placeholder="e.g. డా. పి. ఎస్. వర్మ"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700/80 focus:border-amber-500/60 text-slate-100 outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block font-medium text-slate-300">
                Author / Songwriter (English Script)
              </label>
              <input
                type="text"
                value={authorEnglish}
                onChange={(e) => setAuthorEnglish(e.target.value)}
                placeholder="e.g. Dr. P. S. Varma"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700/80 focus:border-amber-500/60 text-slate-100 outline-none"
              />
            </div>
          </div>
        </div>

        {/* SECTION D: Categories */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-md backdrop-blur-sm">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
            <div className="flex items-center gap-2.5 text-amber-400 font-semibold text-sm sm:text-base">
              <Tag className="w-4 h-4" />
              <span>D. Categories (Thematic Grouping)</span>
            </div>
            <span className="text-[11px] text-slate-400">
              Selected: <strong className="text-slate-200">{selectedCategories.length}</strong>
            </span>
          </div>

          {categoryLoadError && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
              Notice: Unable to load latest categories from database ({categoryLoadError}). Existing assignments will be preserved.
            </div>
          )}

          <div className="space-y-3">
            <p className="text-xs text-slate-400 leading-relaxed">
              Select one or more categories below to associate this hymn with ministry themes.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              {availableCategories.map((cat) => {
                const isSelected = selectedCategories.includes(cat.name);
                return (
                  <button
                    key={cat.id || cat.name}
                    type="button"
                    onClick={() => toggleCategory(cat.name)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm shadow-amber-500/10'
                        : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-300'
                    }`}
                  >
                    <span>{cat.name}</span>
                    {isSelected && <CheckCircle2 className="w-3 h-3 text-amber-400" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* SECTION E: Media & Assets */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-md backdrop-blur-sm">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-800/80 text-amber-400 font-semibold text-sm sm:text-base">
            <Music className="w-4 h-4" />
            <span>E. Media, Presentation & Chords</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-xs sm:text-sm">
            {/* YouTube ID/URL */}
            <div className="space-y-1.5">
              <label className="block font-medium text-slate-300">YouTube Video ID or Link</label>
              <div className="relative">
                <Video className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                <input
                  type="text"
                  value={youtubeInput}
                  onChange={(e) => setYoutubeInput(e.target.value)}
                  placeholder="e.g. LgaaT_2O6Xs or https://youtu.be/..."
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700/80 focus:border-amber-500/60 text-slate-100 outline-none"
                />
              </div>
            </div>

            {/* PPT URL */}
            <div className="space-y-1.5">
              <label className="block font-medium text-slate-300">PowerPoint Presentation URL</label>
              <div className="relative">
                <FileText className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                <input
                  type="url"
                  value={pptUrl}
                  onChange={(e) => setPptUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700/80 focus:border-amber-500/60 text-slate-100 outline-none"
                />
              </div>
            </div>

            {/* Chord Credits */}
            <div className="space-y-1.5 sm:col-span-2">
              <label className="block font-medium text-slate-300">Chord Transcriber / Credits</label>
              <input
                type="text"
                value={chordCredits}
                onChange={(e) => setChordCredits(e.target.value)}
                placeholder="e.g. Transcribed by Bro. Oliver Paul"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700/80 focus:border-amber-500/60 text-slate-100 outline-none"
              />
            </div>

            {/* Chords Textarea */}
            <div className="space-y-1.5 sm:col-span-2">
              <div className="flex items-center justify-between">
                <label className="block font-medium text-slate-300">Chord Chart Lines</label>
                <span className="text-[11px] text-slate-400">
                  Lines: {chordsText ? chordsText.split('\n').filter((l) => l.trim().length > 0).length : 0}
                </span>
              </div>
              <textarea
                value={chordsText}
                onChange={(e) => setChordsText(e.target.value)}
                rows={6}
                placeholder="Paste chord lines here...&#10;G       C       D       G&#10;Amazing grace how sweet the sound"
                className="w-full px-4 py-3 rounded-2xl bg-slate-950/90 border border-slate-700/80 focus:border-amber-500/60 text-slate-100 placeholder:text-slate-600 outline-none font-mono text-xs leading-relaxed"
              />
            </div>
          </div>
        </div>

        {/* SECTION F: Bible Verses & Devotional */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-md backdrop-blur-sm">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
            <div className="flex items-center gap-2.5 text-amber-400 font-semibold text-sm sm:text-base">
              <BookOpen className="w-4 h-4" />
              <span>F. Scripture & Devotional Reflection</span>
            </div>
            <button
              type="button"
              onClick={addBibleVerse}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Verse</span>
            </button>
          </div>

          {/* Bible Verses List */}
          <div className="space-y-4">
            {bibleVerses.length === 0 ? (
              <p className="text-xs text-slate-500 italic">No Bible verses currently linked.</p>
            ) : (
              bibleVerses.map((verse, idx) => (
                <div key={idx} className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-300">Verse #{idx + 1}</span>
                    <button
                      type="button"
                      onClick={() => removeBibleVerse(idx)}
                      className="text-slate-500 hover:text-rose-400 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <input
                      type="text"
                      value={verse.reference || ''}
                      onChange={(e) => updateBibleVerse(idx, 'reference', e.target.value)}
                      placeholder="Reference (e.g. John 3:16)"
                      className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 outline-none"
                    />
                    <input
                      type="text"
                      value={verse.english || ''}
                      onChange={(e) => updateBibleVerse(idx, 'english', e.target.value)}
                      placeholder="English verse text"
                      className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 outline-none"
                    />
                    <input
                      type="text"
                      value={verse.telugu || ''}
                      onChange={(e) => updateBibleVerse(idx, 'telugu', e.target.value)}
                      placeholder="Telugu verse text"
                      className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 outline-none"
                    />
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Devotional Toggle */}
          <div className="pt-2 border-t border-slate-800/80">
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={showDevotional}
                onChange={(e) => setShowDevotional(e.target.checked)}
                className="rounded bg-slate-800 border-slate-700 text-amber-500 focus:ring-0"
              />
              <span>Include Thematic Devotional & Prayer</span>
            </label>

            {showDevotional && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 text-xs">
                <div className="space-y-1.5">
                  <label className="block text-slate-400 font-medium">Reflection (English)</label>
                  <textarea
                    value={devotional.reflection_english || ''}
                    onChange={(e) => setDevotional((prev) => ({ ...prev, reflection_english: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-slate-400 font-medium">Reflection (Telugu)</label>
                  <textarea
                    value={devotional.reflection_telugu || ''}
                    onChange={(e) => setDevotional((prev) => ({ ...prev, reflection_telugu: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-slate-400 font-medium">Prayer (English)</label>
                  <textarea
                    value={devotional.prayer_english || ''}
                    onChange={(e) => setDevotional((prev) => ({ ...prev, prayer_english: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-slate-400 font-medium">Prayer (Telugu)</label>
                  <textarea
                    value={devotional.prayer_telugu || ''}
                    onChange={(e) => setDevotional((prev) => ({ ...prev, prayer_telugu: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 outline-none"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* SECTION G: Publication Status */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-md backdrop-blur-sm">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-800/80 text-amber-400 font-semibold text-sm sm:text-base">
            <Eye className="w-4 h-4" />
            <span>G. Publication Status</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label
              className={`flex items-start gap-3.5 p-4 rounded-2xl border cursor-pointer transition-all ${
                isPublished
                  ? 'bg-amber-500/10 border-amber-500/50 shadow-sm shadow-amber-500/10'
                  : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
              }`}
            >
              <input
                type="radio"
                name="is_published"
                checked={isPublished === true}
                onChange={() => setIsPublished(true)}
                className="mt-1 text-amber-500 focus:ring-0"
              />
              <div>
                <div className="flex items-center gap-1.5 font-semibold text-slate-200 text-xs sm:text-sm">
                  <Eye className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Published (Live in Public Catalog)</span>
                </div>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Visible to congregants across web and mobile searches.
                </p>
              </div>
            </label>

            <label
              className={`flex items-start gap-3.5 p-4 rounded-2xl border cursor-pointer transition-all ${
                !isPublished
                  ? 'bg-amber-500/10 border-amber-500/50 shadow-sm shadow-amber-500/10'
                  : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
              }`}
            >
              <input
                type="radio"
                name="is_published"
                checked={isPublished === false}
                onChange={() => setIsPublished(false)}
                className="mt-1 text-amber-500 focus:ring-0"
              />
              <div>
                <div className="flex items-center gap-1.5 font-semibold text-slate-200 text-xs sm:text-sm">
                  <EyeOff className="w-3.5 h-3.5 text-amber-400" />
                  <span>Draft (Hidden from Public Catalog)</span>
                </div>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Reserved for administrator review and editing. Inaccessible to anonymous congregants.
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* SECTION H: Songbook Associations (Phase 9B-6) */}
        <div className="space-y-4">
          <AdminSongbookManager
            songId={loadedSong.id}
            songTitle={loadedSong.title}
          />
        </div>

        {/* Bottom Actions Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-800">
          <button
            type="button"
            onClick={handleBackClick}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Cancel & Back to List</span>
          </button>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3 rounded-xl text-xs sm:text-sm font-bold bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-lg shadow-amber-500/20 transition-all disabled:opacity-50 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Saving Changes...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save Hymn Changes</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Unsaved Changes Confirmation Modal */}
      {showUnsavedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="max-w-md w-full p-6 rounded-3xl bg-slate-900 border border-amber-500/30 shadow-2xl text-slate-100 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-100">Unsaved Changes</h3>
              <p className="text-xs sm:text-sm text-slate-400 mt-1 leading-relaxed">
                You have modified fields for <span className="text-slate-200 font-semibold">{loadedSong.title}</span>. Leaving now will discard your unsaved changes.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowUnsavedModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
              >
                Keep Editing
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowUnsavedModal(false);
                  if (onBackToList) onBackToList();
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow-md transition-colors"
              >
                Discard & Exit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
