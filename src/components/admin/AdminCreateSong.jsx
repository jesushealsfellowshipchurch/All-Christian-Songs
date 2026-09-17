import React, { useState, useEffect, useCallback } from 'react';
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
  Languages
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  createSong,
  slugify,
  deriveAlphabet,
  normalizeLyricsArray,
  checkSlugAvailability,
  fetchAvailableCategories,
  formatAdminError
} from '../../services/adminSongService';
import TransliteratorService from '../../utils/transliterator';

function extractYoutubeId(input) {
  if (!input) return '';
  const trimmed = input.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  const match = trimmed.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
  return match ? match[1] : trimmed;
}

/**
 * AdminCreateSong Component
 * 
 * Provides production-grade hymn creation for authenticated administrators.
 * Inserts records directly into public.songs under PostgreSQL RLS verification.
 * 
 * Strict Schema Adherence:
 * Uses only the authoritative 22 columns of public.songs.
 * Zero writes to songbook_songs (deferred to Phase 9B-6).
 * Zero writes to pinned_songs.
 */
export default function AdminCreateSong({ onBackToList, onSuccess }) {
  const { session, user, profile, loading: authLoading } = useAuth();

  // Basic Information
  const [title, setTitle] = useState('');
  const [titleTransliterated, setTitleTransliterated] = useState('');
  const [slug, setSlug] = useState('');
  const [autoSlug, setAutoSlug] = useState(true);
  const [language, setLanguage] = useState('telugu');
  const [alphabet, setAlphabet] = useState('');
  const [autoAlphabet, setAutoAlphabet] = useState(true);

  // Slug UX Availability State
  const [slugChecking, setSlugChecking] = useState(false);
  const [slugAvailable, setSlugAvailable] = useState(null);
  const [slugCheckMessage, setSlugCheckMessage] = useState('');

  // Lyrics (Stanza preservation)
  const [lyricsOriginalText, setLyricsOriginalText] = useState('');
  const [lyricsTransliteratedText, setLyricsTransliteratedText] = useState('');

  // Authors
  const [authorTelugu, setAuthorTelugu] = useState('');
  const [authorEnglish, setAuthorEnglish] = useState('');

  // Categories
  const [availableCategories, setAvailableCategories] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoriesError, setCategoriesError] = useState(null);
  const [selectedCategories, setSelectedCategories] = useState([]);

  // Media & Chords
  const [youtubeInput, setYoutubeInput] = useState('');
  const [pptUrl, setPptUrl] = useState('');
  const [chordsText, setChordsText] = useState('');
  const [chordCredits, setChordCredits] = useState('');

  // Bible Verses & Devotional
  const [bibleVerses, setBibleVerses] = useState([]);
  const [showDevotional, setShowDevotional] = useState(false);
  const [devotional, setDevotional] = useState({
    reflection_english: '',
    reflection_telugu: '',
    prayer_english: '',
    prayer_telugu: ''
  });

  // Publication Status
  const [isPublished, setIsPublished] = useState(true);

  // Submission & Lifecycle States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [createdSongResult, setCreatedSongResult] = useState(null);

  // Fetch standard/database categories on component mount
  useEffect(() => {
    let isMounted = true;
    setCategoriesLoading(true);
    setCategoriesError(null);

    fetchAvailableCategories()
      .then((res) => {
        if (!isMounted) return;
        if (res.error) {
          setCategoriesError(res.error);
          setAvailableCategories([]);
        } else {
          setAvailableCategories(res.categories || []);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setCategoriesError('Unable to load catalog categories.');
      })
      .finally(() => {
        if (isMounted) setCategoriesLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Synchronize auto-slug when title changes
  useEffect(() => {
    if (autoSlug) {
      const derived = slugify(titleTransliterated || title);
      setSlug(derived);
    }
  }, [title, titleTransliterated, autoSlug]);

  // Synchronize auto-alphabet when title or language changes
  useEffect(() => {
    if (autoAlphabet) {
      const derived = deriveAlphabet(title, language);
      setAlphabet(derived);
    }
  }, [title, language, autoAlphabet]);

  // Debounced check for slug availability (UX assistance only)
  useEffect(() => {
    if (!slug) {
      setSlugAvailable(null);
      setSlugCheckMessage('');
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
        setSlugCheckMessage('Slug is available');
      } else {
        setSlugAvailable(false);
        setSlugCheckMessage('A song with this slug already exists in the catalog');
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [slug]);

  // Toggle category in array
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

  // Form Reset
  const handleResetForm = () => {
    setTitle('');
    setTitleTransliterated('');
    setSlug('');
    setAutoSlug(true);
    setLanguage('telugu');
    setAlphabet('A');
    setAutoAlphabet(true);
    setLyricsOriginalText('');
    setLyricsTransliteratedText('');
    setAuthorTelugu('');
    setAuthorEnglish('');
    setSelectedCategories([]);
    setYoutubeInput('');
    setPptUrl('');
    setChordsText('');
    setChordCredits('');
    setBibleVerses([]);
    setShowDevotional(false);
    setDevotional({
      reflection_english: '',
      reflection_telugu: '',
      prayer_english: '',
      prayer_telugu: ''
    });
    setIsPublished(true);
    setSubmitError(null);
    setCreatedSongResult(null);
  };

  // Form Submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError(null);

    // 1. Client-side field validations
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setSubmitError('Song Title is required.');
      return;
    }

    const cleanSlug = slugify(slug || titleTransliterated || cleanTitle);
    if (!cleanSlug) {
      setSubmitError('A valid URL slug is required.');
      return;
    }

    const rawLyricsOriginal = normalizeLyricsArray(lyricsOriginalText);
    const hasValidLine = rawLyricsOriginal.some((line) => line.trim().length > 0);
    if (!hasValidLine) {
      setSubmitError('Original Lyrics are required. Please enter at least one stanza line.');
      return;
    }

    // 2. Chords array normalization
    let chordsArray = null;
    let calculatedChordCount = 0;
    if (chordsText.trim()) {
      const rawChords = chordsText.split(/\r?\n/).map((l) => l.trimEnd());
      if (rawChords.length > 0) {
        chordsArray = rawChords;
        calculatedChordCount = rawChords.filter((l) => l.trim().length > 0).length;
      }
    }

    // 3. Bible verses array normalization (clean out empty rows)
    const validBibleVerses = bibleVerses
      .filter((v) => (v.reference && v.reference.trim()) || (v.english && v.english.trim()) || (v.telugu && v.telugu.trim()))
      .map((v) => ({
        reference: (v.reference || '').trim(),
        english: (v.english || '').trim(),
        telugu: (v.telugu || '').trim()
      }));

    // 4. Devotional object normalization
    let devotionalPayload = null;
    const hasDevotionalContent =
      devotional.reflection_english.trim() ||
      devotional.reflection_telugu.trim() ||
      devotional.prayer_english.trim() ||
      devotional.prayer_telugu.trim();

    if (hasDevotionalContent) {
      devotionalPayload = {
        reflection_english: devotional.reflection_english.trim() || null,
        reflection_telugu: devotional.reflection_telugu.trim() || null,
        prayer_english: devotional.prayer_english.trim() || null,
        prayer_telugu: devotional.prayer_telugu.trim() || null
      };
    }

    // 5. Construct pure 22-column payload
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
      songbooks: [], // JSONB default, no songbook_songs writes
      ppt_url: pptUrl.trim() || null,
      bible_verses: validBibleVerses,
      devotional: devotionalPayload,
      is_published: Boolean(isPublished)
    };

    // 6. Submit via adminSongService.createSong under RLS
    setIsSubmitting(true);
    try {
      const result = await createSong(payload);
      if (!result.success) {
        setSubmitError(result.error || 'Failed to create song.');
      } else {
        setCreatedSongResult(result.song);
        if (onSuccess) {
          onSuccess(result.song);
        }
      }
    } catch (err) {
      setSubmitError(formatAdminError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  // 1. Auth Loading State
  if (authLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-slate-300">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin mb-4" />
        <p className="text-sm font-medium">Verifying administrator credentials...</p>
      </div>
    );
  }

  // 2. Unauthenticated State
  if (!session || !user) {
    return (
      <div className="max-w-2xl mx-auto my-12 p-8 bg-slate-900/90 border border-slate-800 rounded-3xl text-center shadow-xl backdrop-blur-md">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-100 mb-2">Administrator Access Required</h2>
        <p className="text-sm text-slate-400 mb-6 leading-relaxed">
          Creating new hymnal records requires an active administrator session.
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

  // 3. Unauthorized Profile State
  if (profile?.role !== 'admin') {
    return (
      <div className="max-w-2xl mx-auto my-12 p-8 bg-slate-900/90 border border-rose-500/30 rounded-3xl text-center shadow-xl backdrop-blur-md">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-100 mb-2">Permission Denied</h2>
        <p className="text-sm text-slate-400 mb-6 leading-relaxed">
          Your account (<span className="text-slate-200 font-medium">{user.email}</span>) does not have
          administrator privileges to create new catalog songs.
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

  // 4. Creation Success Screen
  if (createdSongResult) {
    return (
      <div className="max-w-2xl mx-auto my-12 p-8 bg-slate-900 border border-emerald-500/40 rounded-3xl text-center shadow-2xl text-slate-100 animate-fadeIn">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-slate-100 mb-1">Song Created Successfully</h2>
        <p className="text-sm text-slate-400 mb-6">
          The hymn has been recorded in the database under Row Level Security.
        </p>

        <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 text-left space-y-2 mb-8 text-xs sm:text-sm">
          <div className="flex justify-between border-b border-slate-800/80 pb-2">
            <span className="text-slate-500">Title:</span>
            <span className="font-semibold text-slate-200">{createdSongResult.title}</span>
          </div>
          {createdSongResult.title_transliterated && (
            <div className="flex justify-between border-b border-slate-800/80 pb-2">
              <span className="text-slate-500">Transliteration:</span>
              <span className="italic text-slate-300">{createdSongResult.title_transliterated}</span>
            </div>
          )}
          <div className="flex justify-between border-b border-slate-800/80 pb-2">
            <span className="text-slate-500">Slug:</span>
            <span className="font-mono text-amber-400">{createdSongResult.slug}</span>
          </div>
          <div className="flex justify-between border-b border-slate-800/80 pb-2">
            <span className="text-slate-500">Language:</span>
            <span className="capitalize text-slate-300">{createdSongResult.language}</span>
          </div>
          <div className="flex justify-between pt-1">
            <span className="text-slate-500">Status:</span>
            <span className={createdSongResult.is_published ? 'text-emerald-400 font-semibold' : 'text-amber-400 font-semibold'}>
              {createdSongResult.is_published ? 'Published (Live)' : 'Draft (Unpublished)'}
            </span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={handleResetForm}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Create Another Song</span>
          </button>
          <button
            onClick={onBackToList}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Song List</span>
          </button>
        </div>
      </div>
    );
  }

  // Lyrics Stanza Metrics
  const lyricsLines = normalizeLyricsArray(lyricsOriginalText);
  const nonEmptyLinesCount = lyricsLines.filter((l) => l.trim().length > 0).length;
  const stanzaCount = lyricsLines.filter((l) => l === '').length + (nonEmptyLinesCount > 0 ? 1 : 0);

  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-8 text-slate-100 animate-fadeIn">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <button
              onClick={onBackToList}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
              title="Return to list"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-100">
              Create New Song
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
              PostgreSQL RLS
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 pl-9">
            Add a new hymn to the church catalog following the authoritative 22-column schema.
          </p>
        </div>
      </div>

      {/* Global Submit Error Banner */}
      {submitError && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-rose-950/40 border border-rose-500/40 text-rose-200 text-xs sm:text-sm animate-fadeIn">
          <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-1 flex-1">
            <h4 className="font-semibold text-rose-100">Unable to create song</h4>
            <p className="leading-relaxed text-rose-300">{submitError}</p>
          </div>
        </div>
      )}

      {/* Main Creation Form */}
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
              <div className="flex items-center justify-between">
                <label className="block font-medium text-slate-300">
                  Song Title (Primary Script) <span className="text-amber-400">*</span>
                </label>
                {title.trim() && !TransliteratorService.isTelugu(title) && language === 'telugu' && (
                  <button
                    type="button"
                    onClick={() => setTitle(TransliteratorService.toTelugu(title.trim()))}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-semibold bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 hover:bg-indigo-500/25 transition-colors"
                    title="Convert phonetic English text to Telugu script"
                  >
                    <Languages className="w-3 h-3" />
                    <span>To Telugu Script</span>
                  </button>
                )}
              </div>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() => {
                  if (title.trim() && !titleTransliterated.trim() && TransliteratorService.isTelugu(title)) {
                    setTitleTransliterated(TransliteratorService.transliterate(title.trim(), 'telugu'));
                  }
                }}
                placeholder="e.g. లేచినాడురా సమాధి గెలిచినాడురా or Amazing Grace"
                required
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700/80 focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/50 text-slate-100 placeholder:text-slate-500 outline-none"
              />
            </div>

            {/* Transliterated Title */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block font-medium text-slate-300">
                  Transliterated Title (English Script)
                </label>
                {title.trim() && TransliteratorService.isTelugu(title) && (
                  <button
                    type="button"
                    onClick={() => setTitleTransliterated(TransliteratorService.transliterate(title.trim(), 'telugu'))}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 transition-colors"
                    title="Auto-transliterate Telugu title to English script"
                  >
                    <Languages className="w-3 h-3" />
                    <span>Transliterate</span>
                  </button>
                )}
              </div>
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
                <label className="inline-flex items-center gap-1.5 text-[11px] text-slate-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoSlug}
                    onChange={(e) => setAutoSlug(e.target.checked)}
                    className="rounded bg-slate-800 border-slate-700 text-amber-500 focus:ring-0"
                  />
                  <span>Auto-generate</span>
                </label>
              </div>
              <input
                type="text"
                value={slug}
                disabled={autoSlug}
                onChange={(e) => setSlug(slugify(e.target.value))}
                placeholder="e.g. lechinaaduraa-samaadhi-gelichinaaduraa"
                required
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700/80 focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/50 text-slate-100 placeholder:text-slate-500 outline-none disabled:opacity-75 font-mono text-xs"
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

            {/* Alphabet Index Character */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block font-medium text-slate-300">
                  Alphabet Grouping Letter <span className="text-amber-400">*</span>
                </label>
                <label className="inline-flex items-center gap-1.5 text-[11px] text-slate-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoAlphabet}
                    onChange={(e) => setAutoAlphabet(e.target.checked)}
                    className="rounded bg-slate-800 border-slate-700 text-amber-500 focus:ring-0"
                  />
                  <span>Auto-detect</span>
                </label>
              </div>
              <input
                type="text"
                value={alphabet}
                disabled={autoAlphabet}
                onChange={(e) => setAlphabet(e.target.value.trim())}
                maxLength={4}
                required
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700/80 focus:border-amber-500/60 text-slate-100 outline-none disabled:opacity-75 font-semibold text-center sm:text-left"
              />
            </div>
          </div>
        </div>

        {/* SECTION B: Lyrics & Stanzas */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-md backdrop-blur-sm">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 text-amber-400 font-semibold text-sm sm:text-base">
            <div className="flex items-center gap-2.5">
              <FileText className="w-4 h-4" />
              <span>B. Lyrics & Stanzas</span>
            </div>
            <div className="text-[11px] font-normal text-slate-400">
              {stanzaCount} stanza(s) · {nonEmptyLinesCount} lines
            </div>
          </div>

          <div className="space-y-4 text-xs sm:text-sm">
            {/* Original Lyrics */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block font-medium text-slate-300">
                  Original Lyrics (Primary Script) <span className="text-amber-400">*</span>
                </label>
                <span className="text-[11px] text-slate-400">
                  Separate stanzas with an empty line
                </span>
              </div>
              <textarea
                rows={10}
                value={lyricsOriginalText}
                onChange={(e) => setLyricsOriginalText(e.target.value)}
                placeholder={`పల్లవి:\nలేచినాడురా సమాధి గెలిచినాడురా\nమరణపు ముల్లును విరిచినాడురా\n\nచరణం 1:\nసాతాను తలను చితకద్రొక్కినాడు\nసమాధి బంధకాలను తెంచినాడు`}
                required
                className="w-full p-4 rounded-2xl bg-slate-950/90 border border-slate-700/80 focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/50 text-slate-100 font-sans text-sm leading-relaxed placeholder:text-slate-600 outline-none"
              />
              <p className="text-[11px] text-slate-500">
                Stanza boundaries (empty lines) are preserved strictly as empty strings in the database array.
              </p>
            </div>

            {/* Transliterated Lyrics */}
            <div className="space-y-1.5 pt-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <label className="block font-medium text-slate-300">
                  Transliterated Lyrics (Roman Script, Optional)
                </label>
                <div className="flex items-center gap-2">
                  {lyricsOriginalText.trim() && TransliteratorService.isTelugu(lyricsOriginalText) && (
                    <button
                      type="button"
                      onClick={() => setLyricsTransliteratedText(TransliteratorService.transliterate(lyricsOriginalText.trim(), 'telugu'))}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 transition-colors"
                      title="Auto-transliterate Telugu lyrics to English script"
                    >
                      <Languages className="w-3 h-3" />
                      <span>Transliterate</span>
                    </button>
                  )}
                  <span className="text-[11px] text-slate-400">
                    Separate stanzas with an empty line
                  </span>
                </div>
              </div>
              <textarea
                rows={8}
                value={lyricsTransliteratedText}
                onChange={(e) => setLyricsTransliteratedText(e.target.value)}
                placeholder={`Pallavi:\nLechinaaduraa samaadhi gelichinaaduraa\nMaranapu mullunu virichinaaduraa\n\nCharanam 1:\nSaathaanu thalanu chithakadhrokkinadu\nSamaadhi bandhakaalanu thenchinaadu`}
                className="w-full p-4 rounded-2xl bg-slate-950/90 border border-slate-700/80 focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/50 text-slate-100 font-sans text-sm leading-relaxed placeholder:text-slate-600 outline-none"
              />
            </div>
          </div>
        </div>

        {/* SECTION C: Authorship */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-md backdrop-blur-sm">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-800/80 text-amber-400 font-semibold text-sm sm:text-base">
            <BookOpen className="w-4 h-4" />
            <span>C. Songwriter & Authorship</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-xs sm:text-sm">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block font-medium text-slate-300">
                  Author (Telugu Script)
                </label>
                {authorEnglish.trim() && !authorTelugu.trim() && (
                  <button
                    type="button"
                    onClick={() => setAuthorTelugu(TransliteratorService.toTelugu(authorEnglish.trim()))}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-semibold bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 hover:bg-indigo-500/25 transition-colors"
                    title="Convert English author name to Telugu script"
                  >
                    <Languages className="w-3 h-3" />
                    <span>To Telugu</span>
                  </button>
                )}
              </div>
              <input
                type="text"
                value={authorTelugu}
                onChange={(e) => setAuthorTelugu(e.target.value)}
                onBlur={() => {
                  if (authorTelugu.trim() && !authorEnglish.trim() && TransliteratorService.isTelugu(authorTelugu)) {
                    setAuthorEnglish(TransliteratorService.transliterate(authorTelugu.trim(), 'telugu'));
                  }
                }}
                placeholder="e.g. పాస్టర్ పి.ఆర్. జాన్"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700/80 focus:border-amber-500/60 text-slate-100 placeholder:text-slate-500 outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block font-medium text-slate-300">
                  Author (English Script)
                </label>
                {authorTelugu.trim() && TransliteratorService.isTelugu(authorTelugu) && (
                  <button
                    type="button"
                    onClick={() => setAuthorEnglish(TransliteratorService.transliterate(authorTelugu.trim(), 'telugu'))}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 transition-colors"
                    title="Auto-transliterate Telugu author to English script"
                  >
                    <Languages className="w-3 h-3" />
                    <span>Transliterate</span>
                  </button>
                )}
              </div>
              <input
                type="text"
                value={authorEnglish}
                onChange={(e) => setAuthorEnglish(e.target.value)}
                placeholder="e.g. Pastor P.R. John"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700/80 focus:border-amber-500/60 text-slate-100 placeholder:text-slate-500 outline-none"
              />
            </div>
          </div>
        </div>

        {/* SECTION D: Categories */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-md backdrop-blur-sm">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 text-amber-400 font-semibold text-sm sm:text-base">
            <div className="flex items-center gap-2.5">
              <Tag className="w-4 h-4" />
              <span>D. Categories & Themes</span>
            </div>
            <span className="text-[11px] font-normal text-slate-400">
              {selectedCategories.length} selected
            </span>
          </div>

          <div className="space-y-3">
            {categoriesLoading ? (
              <div className="flex items-center gap-2 text-xs text-slate-400 p-2">
                <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                <span>Loading catalog categories...</span>
              </div>
            ) : categoriesError ? (
              <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-500/30 text-rose-300 text-xs">
                {categoriesError}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2 pt-1">
                {availableCategories.map((catName) => {
                  const isChecked = selectedCategories.includes(catName);
                  return (
                    <button
                      type="button"
                      key={catName}
                      onClick={() => toggleCategory(catName)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                        isChecked
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-xs'
                          : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200'
                      }`}
                    >
                      <span>{catName}</span>
                      {isChecked && <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />}
                    </button>
                  );
                })}
              </div>
            )}
            <p className="text-[11px] text-slate-500 pt-1">
              Select one or more matching categories for thematic catalog filtering. Songs can be created without categories.
            </p>
          </div>
        </div>

        {/* SECTION E: Media & Chords */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-md backdrop-blur-sm">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-800/80 text-amber-400 font-semibold text-sm sm:text-base">
            <Video className="w-4 h-4" />
            <span>E. Media & Chord Charts</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-xs sm:text-sm">
            {/* YouTube Video */}
            <div className="space-y-1.5">
              <label className="block font-medium text-slate-300">
                YouTube Video URL or ID
              </label>
              <input
                type="text"
                value={youtubeInput}
                onChange={(e) => setYoutubeInput(e.target.value)}
                placeholder="e.g. https://www.youtube.com/watch?v=LgaaT_2O6Xs or LgaaT_2O6Xs"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700/80 focus:border-amber-500/60 text-slate-100 placeholder:text-slate-500 outline-none"
              />
              {extractYoutubeId(youtubeInput) && (
                <p className="text-[11px] text-slate-400">
                  Extracted ID: <span className="font-mono text-amber-400">{extractYoutubeId(youtubeInput)}</span>
                </p>
              )}
            </div>

            {/* PowerPoint Presentation URL */}
            <div className="space-y-1.5">
              <label className="block font-medium text-slate-300">
                PowerPoint Presentation URL (PPTX)
              </label>
              <input
                type="url"
                value={pptUrl}
                onChange={(e) => setPptUrl(e.target.value)}
                placeholder="e.g. https://storage.supabase.co/.../hymn.pptx"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700/80 focus:border-amber-500/60 text-slate-100 placeholder:text-slate-500 outline-none"
              />
            </div>

            {/* Chords Textarea */}
            <div className="space-y-1.5 sm:col-span-2">
              <div className="flex items-center justify-between">
                <label className="block font-medium text-slate-300">
                  Guitar / Keyboard Chords (TEXT[])
                </label>
                <span className="text-[11px] text-slate-400">
                  One line per lyric line
                </span>
              </div>
              <textarea
                rows={6}
                value={chordsText}
                onChange={(e) => setChordsText(e.target.value)}
                placeholder="[Em]   [D]   [C]   [B7]"
                className="w-full p-3.5 rounded-xl bg-slate-950/90 border border-slate-700/80 focus:border-amber-500/60 font-mono text-xs text-amber-300/90 leading-relaxed outline-none"
              />
            </div>

            {/* Chord Credits */}
            <div className="space-y-1.5 sm:col-span-2">
              <label className="block font-medium text-slate-300">
                Chords Attribution / Credits
              </label>
              <input
                type="text"
                value={chordCredits}
                onChange={(e) => setChordCredits(e.target.value)}
                placeholder="e.g. Chords prepared by Bro. Oliver Paul"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700/80 focus:border-amber-500/60 text-slate-100 placeholder:text-slate-500 outline-none"
              />
            </div>
          </div>
        </div>

        {/* SECTION F: Bible Verses & Devotional */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-md backdrop-blur-sm">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 text-amber-400 font-semibold text-sm sm:text-base">
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-4 h-4" />
              <span>F. Scripture & Devotional Commentary</span>
            </div>
            <button
              type="button"
              onClick={addBibleVerse}
              className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Scripture</span>
            </button>
          </div>

          {/* Dynamic Bible Verses List */}
          <div className="space-y-3">
            {bibleVerses.length === 0 ? (
              <p className="text-xs text-slate-500 italic">No scripture references added. Click &quot;Add Scripture&quot; to link Bible verses.</p>
            ) : (
              bibleVerses.map((verse, idx) => (
                <div key={idx} className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-300">Verse #{idx + 1}</span>
                    <button
                      type="button"
                      onClick={() => removeBibleVerse(idx)}
                      className="text-rose-400 hover:text-rose-300 p-1"
                      title="Remove scripture"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      type="text"
                      placeholder="Reference (e.g. John 11:25)"
                      value={verse.reference}
                      onChange={(e) => updateBibleVerse(idx, 'reference', e.target.value)}
                      className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 outline-none"
                    />
                    <input
                      type="text"
                      placeholder="Telugu text"
                      value={verse.telugu}
                      onChange={(e) => updateBibleVerse(idx, 'telugu', e.target.value)}
                      className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 outline-none"
                    />
                    <input
                      type="text"
                      placeholder="English text"
                      value={verse.english}
                      onChange={(e) => updateBibleVerse(idx, 'english', e.target.value)}
                      className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 outline-none"
                    />
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Devotional Toggle */}
          <div className="pt-2 border-t border-slate-800/80">
            <button
              type="button"
              onClick={() => setShowDevotional(!showDevotional)}
              className="text-xs font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1.5"
            >
              <span>{showDevotional ? '− Hide Devotional Commentary' : '+ Add Devotional Reflection & Prayer'}</span>
            </button>

            {showDevotional && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 text-xs">
                <div className="space-y-1">
                  <label className="block text-slate-300 font-medium">Reflection (English)</label>
                  <textarea
                    rows={3}
                    value={devotional.reflection_english}
                    onChange={(e) => setDevotional({ ...devotional, reflection_english: e.target.value })}
                    placeholder="Worship reflection points..."
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-slate-300 font-medium">Reflection (Telugu)</label>
                  <textarea
                    rows={3}
                    value={devotional.reflection_telugu}
                    onChange={(e) => setDevotional({ ...devotional, reflection_telugu: e.target.value })}
                    placeholder="ధ్యాన అంశాలు..."
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-slate-300 font-medium">Closing Prayer (English)</label>
                  <textarea
                    rows={3}
                    value={devotional.prayer_english}
                    onChange={(e) => setDevotional({ ...devotional, prayer_english: e.target.value })}
                    placeholder="Closing prayer..."
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-slate-300 font-medium">Closing Prayer (Telugu)</label>
                  <textarea
                    rows={3}
                    value={devotional.prayer_telugu}
                    onChange={(e) => setDevotional({ ...devotional, prayer_telugu: e.target.value })}
                    placeholder="ప్రార్థన..."
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 outline-none"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* SECTION G: Publication */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-4 shadow-md backdrop-blur-sm">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-800/80 text-amber-400 font-semibold text-sm sm:text-base">
            <CheckCircle2 className="w-4 h-4" />
            <span>G. Catalog Publication Visibility</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs sm:text-sm">
            <label
              className={`flex items-start gap-3 p-4 rounded-2xl border cursor-pointer transition-all ${
                isPublished
                  ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-200'
                  : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <input
                type="radio"
                name="is_published"
                checked={isPublished === true}
                onChange={() => setIsPublished(true)}
                className="mt-0.5 text-emerald-500 focus:ring-0"
              />
              <div className="space-y-0.5">
                <span className="font-semibold text-slate-100 block">Published (Live)</span>
                <span className="text-xs text-slate-400 block leading-relaxed">
                  Song will be immediately discoverable in the public catalog and search indexes.
                </span>
              </div>
            </label>

            <label
              className={`flex items-start gap-3 p-4 rounded-2xl border cursor-pointer transition-all ${
                !isPublished
                  ? 'bg-amber-500/10 border-amber-500/40 text-amber-200'
                  : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <input
                type="radio"
                name="is_published"
                checked={isPublished === false}
                onChange={() => setIsPublished(false)}
                className="mt-0.5 text-amber-500 focus:ring-0"
              />
              <div className="space-y-0.5">
                <span className="font-semibold text-slate-100 block">Draft / Unpublished</span>
                <span className="text-xs text-slate-400 block leading-relaxed">
                  Song will be hidden from public visitors and only viewable in the Admin Console.
                </span>
              </div>
            </label>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onBackToList}
            disabled={isSubmitting}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg transition-all disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                <span>Creating Song...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Create Song</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
