import React, { useState } from 'react';
import { 
  X, Music, BookOpen, Guitar, Video, FileText, Check, 
  Sparkles, AlertCircle, Plus, Layers, Globe, ExternalLink,
  Wand2, Pin
} from 'lucide-react';
import TransliteratorService from '../utils/transliterator';
import { pinSong } from '../utils/pinManager';

const AVAILABLE_CATEGORIES = [
  'Worship Songs',
  'Praise Songs',
  'Prayer Songs',
  'Hope Songs',
  'Christmas Songs',
  'Easter Songs',
  'Gospel Songs',
  'Encouraging Songs',
  'Comfort Songs',
  'Sunday School Songs',
  'Holy Spirit Songs',
  'Fasting Prayer Songs',
  'Thanksgiving Songs',
  'Repentance Songs',
  'Commitment Songs',
  'Second Coming Songs'
];

const AVAILABLE_SONGBOOKS = [
  { slug: '', title: 'None / General Single' },
  { slug: 'andhra-kraisthava-keerthanalu', title: 'Andhra Kraisthava Keerthanalu (ఆంధ్ర క్రైస్తవ కీర్తనలు)' },
  { slug: 'hosanna-ministries', title: 'Hosanna Ministries (హోసన్నా మినిస్ట్రీస్)' },
  { slug: 'songs-of-zion', title: 'Songs of Zion (సీయోను గీతాలు)' },
  { slug: 'vidhyaarthi-geethaavali', title: 'Vidhyaarthi Geethaavali (విద్యార్థి గీతావళి)' },
  { slug: 'joyful-journey', title: 'Joyful Journey' },
  { slug: 'joyful-journey-sunday-school', title: 'Joyful Journey - Sunday School' },
  { slug: 'joyful-journey-pallavulu', title: 'Joyful Journey - Pallavulu' },
  { slug: 'joyful-journey-choruses', title: 'Joyful Journey - Choruses' }
];

function extractYoutubeId(input) {
  if (!input) return '';
  const trimmed = input.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  const match = trimmed.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
  return match ? match[1] : trimmed;
}

export default function AdminPublishModal({ isOpen, onClose, onSongPublished }) {
  const [activeTab, setActiveTab] = useState('basics'); // 'basics' | 'categories' | 'lyrics' | 'media'

  // Form State
  const [title, setTitle] = useState('');
  const [titleTransliterated, setTitleTransliterated] = useState('');
  const [language, setLanguage] = useState('telugu');
  const [authorEnglish, setAuthorEnglish] = useState('');
  const [authorTelugu, setAuthorTelugu] = useState('');

  const [selectedCategories, setSelectedCategories] = useState(['Worship Songs']);
  const [selectedSongbook, setSelectedSongbook] = useState('');
  const [songNumber, setSongNumber] = useState('');

  const [lyricsOriginal, setLyricsOriginal] = useState('');
  const [lyricsTransliterated, setLyricsTransliterated] = useState('');
  const [chordsText, setChordsText] = useState('');
  const [chordCredits, setChordCredits] = useState('Jesus Heals Fellowship');

  const [youtubeInput, setYoutubeInput] = useState('');
  const [pptUrl, setPptUrl] = useState('');
  const [pinToLanding, setPinToLanding] = useState(false);
  const [pinNumberToSet, setPinNumberToSet] = useState('');

  // Transliteration Controls
  const [autoSyncLyrics, setAutoSyncLyrics] = useState(true);
  const [autoSyncTitle, setAutoSyncTitle] = useState(true);
  const [autoSyncAuthor, setAutoSyncAuthor] = useState(true);
  const [lyricsTransliteratedNotification, setLyricsTransliteratedNotification] = useState(false);
  const [titleTransliteratedNotification, setTitleTransliteratedNotification] = useState(false);
  const [authorEnglishNotification, setAuthorEnglishNotification] = useState(false);
  const [authorTeluguNotification, setAuthorTeluguNotification] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successData, setSuccessData] = useState(null);

  if (!isOpen) return null;

  const toggleCategory = (cat) => {
    setSelectedCategories(prev => 
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const handleInsertTag = (targetSetter, currentText, tag) => {
    targetSetter(prev => prev ? `${prev}\n\n${tag}\n` : `${tag}\n`);
  };

  const handleResetForm = () => {
    setTitle('');
    setTitleTransliterated('');
    setLanguage('telugu');
    setAuthorEnglish('');
    setAuthorTelugu('');
    setSelectedCategories(['Worship Songs']);
    setSelectedSongbook('');
    setSongNumber('');
    setLyricsOriginal('');
    setLyricsTransliterated('');
    setChordsText('');
    setYoutubeInput('');
    setPptUrl('');
    setPinToLanding(false);
    setPinNumberToSet('');
    setAutoSyncLyrics(true);
    setAutoSyncTitle(true);
    setAutoSyncAuthor(true);
    setLyricsTransliteratedNotification(false);
    setTitleTransliteratedNotification(false);
    setAuthorEnglishNotification(false);
    setAuthorTeluguNotification(false);
    setError('');
    setSuccessData(null);
    setActiveTab('basics');
  };

  const handleTitleChange = (val) => {
    setTitle(val);
    if (autoSyncTitle && (language === 'telugu' || TransliteratorService.isTelugu(val))) {
      setTitleTransliterated(TransliteratorService.transliterate(val, 'telugu'));
    }
  };

  const handleManualTransliterateTitle = () => {
    if (title) {
      setTitleTransliterated(TransliteratorService.transliterate(title, language));
      setTitleTransliteratedNotification(true);
      setTimeout(() => setTitleTransliteratedNotification(false), 2000);
    }
  };

  const handleAuthorEnglishChange = (val) => {
    setAuthorEnglish(val);
    if (autoSyncAuthor) {
      if (!val.trim()) {
        setAuthorTelugu('');
      } else {
        setAuthorTelugu(TransliteratorService.toTelugu(val));
      }
    }
  };

  const handleAuthorTeluguChange = (val) => {
    setAuthorTelugu(val);
    if (autoSyncAuthor) {
      if (!val.trim()) {
        setAuthorEnglish('');
      } else {
        setAuthorEnglish(TransliteratorService.transliterate(val, 'telugu'));
      }
    }
  };

  const handleManualTransliterateAuthorEnglish = () => {
    if (authorTelugu) {
      setAuthorEnglish(TransliteratorService.transliterate(authorTelugu, 'telugu'));
      setAuthorEnglishNotification(true);
      setTimeout(() => setAuthorEnglishNotification(false), 2000);
    }
  };

  const handleManualTransliterateAuthorTelugu = () => {
    if (authorEnglish) {
      setAuthorTelugu(TransliteratorService.toTelugu(authorEnglish));
      setAuthorTeluguNotification(true);
      setTimeout(() => setAuthorTeluguNotification(false), 2000);
    }
  };

  const handleLyricsOriginalChange = (val) => {
    setLyricsOriginal(val);
    if (autoSyncLyrics && (language === 'telugu' || TransliteratorService.isTelugu(val))) {
      const trans = TransliteratorService.transliterate(val, 'telugu');
      setLyricsTransliterated(trans);
    }
  };

  const handleManualTransliterateLyrics = () => {
    if (lyricsOriginal) {
      const trans = TransliteratorService.transliterate(lyricsOriginal, language);
      setLyricsTransliterated(trans);
      setLyricsTransliteratedNotification(true);
      setTimeout(() => setLyricsTransliteratedNotification(false), 2500);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Song Title is required');
      setActiveTab('basics');
      return;
    }
    if (!lyricsOriginal.trim()) {
      setError('Original Lyrics are required');
      setActiveTab('lyrics');
      return;
    }

    setIsSubmitting(true);
    setError('');

    // Prepare arrays
    const origLines = lyricsOriginal.split('\n').map(l => l.trimEnd());
    const transLines = lyricsTransliterated.trim() 
      ? lyricsTransliterated.split('\n').map(l => l.trimEnd())
      : [];
    const chordsLines = chordsText.trim() 
      ? chordsText.split('\n').map(l => l.trimEnd())
      : null;

    const parsedYt = extractYoutubeId(youtubeInput);

    const songbooksArr = [];
    if (selectedSongbook) {
      songbooksArr.push({
        book: selectedSongbook,
        ...(songNumber ? { number: parseInt(songNumber, 10) || songNumber } : {})
      });
    }

    const payload = {
      title: title.trim(),
      title_transliterated: titleTransliterated.trim(),
      language: language.toLowerCase(),
      author_english: authorEnglish.trim() || (authorTelugu.trim() ? TransliteratorService.transliterate(authorTelugu.trim(), 'telugu') : null),
      author_telugu: authorTelugu.trim() || (authorEnglish.trim() ? TransliteratorService.toTelugu(authorEnglish.trim()) : null),
      category_names: selectedCategories.length > 0 ? selectedCategories : ['Worship Songs'],
      songbooks: songbooksArr,
      lyrics_original: origLines,
      lyrics_transliterated: transLines,
      chords: chordsLines,
      chord_count: chordsLines ? chordsLines.length : 0,
      chord_credits: chordsLines ? (chordCredits.trim() || 'Jesus Heals Fellowship') : null,
      youtube_id: parsedYt || null,
      ppt_url: pptUrl.trim() || null
    };

    try {
      // Direct publishing is disabled pending Supabase Auth migration
      setError('Song publishing is currently disabled pending Supabase Auth integration. No changes were written to the database.');
    } catch (err) {
      console.error('Publish error:', err);
      setError(err.message || 'Error publishing song');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto animate-fadeIn">
      <div 
        className="relative w-full max-w-4xl bg-slate-900 border border-amber-500/30 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden my-auto flex flex-col max-h-[92vh] text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Modal Header */}
        <div className="px-6 py-4.5 bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border-b border-slate-800 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">Publish New Song</h2>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-400/20 text-amber-300 border border-amber-400/30">
                  Admin Portal
                </span>
              </div>
              <p className="text-xs text-slate-400">Add hymns and worship songs directly into website catalog</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success View */}
        {successData ? (
          <div className="p-8 sm:p-12 flex flex-col items-center justify-center text-center overflow-y-auto">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-400/60 flex items-center justify-center text-emerald-400 mb-5 shadow-lg shadow-emerald-500/20 animate-bounce">
              <Check className="w-8 h-8 stroke-[2.5]" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">Song Published Successfully!</h3>
            <p className="text-slate-300 text-sm max-w-md mb-6 leading-relaxed">
              <span className="font-semibold text-amber-400">{successData.song.title}</span> ({successData.song.title_transliterated || 'No transliteration'}) has been added into the catalog, index, and filesystem.
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <button
                onClick={() => {
                  onClose();
                }}
                className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-xl text-sm transition-all shadow-lg shadow-amber-500/20 flex items-center gap-2"
              >
                <span>View Song in Catalog</span>
                <ExternalLink className="w-4 h-4" />
              </button>
              <button
                onClick={handleResetForm}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-sm font-medium transition-colors"
              >
                Add Another Song
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Navigation Tabs */}
            <div className="px-6 pt-3 bg-slate-900 border-b border-slate-800 flex gap-2 overflow-x-auto flex-shrink-0">
              {[
                { id: 'basics', label: '1. Basic Info', icon: Music },
                { id: 'categories', label: '2. Collections & Categories', icon: BookOpen },
                { id: 'lyrics', label: '3. Lyrics & Chords', icon: FileText },
                { id: 'media', label: '4. Media & PPT', icon: Video }
              ].map(tab => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold rounded-t-xl border-b-2 transition-colors whitespace-nowrap ${
                      isActive
                        ? 'border-amber-400 text-amber-400 bg-slate-800/60'
                        : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Form Error Banner */}
            {error && (
              <div className="mx-6 mt-4 p-3.5 bg-red-950/60 border border-red-500/40 rounded-xl flex items-center gap-2.5 text-xs text-red-300 flex-shrink-0">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Scrollable Form Body */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* TAB 1: BASIC INFO */}
              {activeTab === 'basics' && (
                <div className="space-y-5 animate-fadeIn">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                        Song Title (Native Script) <span className="text-amber-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={title}
                        onChange={(e) => handleTitleChange(e.target.value)}
                        placeholder="e.g. యేసు నామం అతి మధురం"
                        className="w-full px-4 py-3 bg-slate-950/70 border border-slate-700/80 focus:border-amber-500 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition-all font-telugu"
                      />
                      <p className="mt-1 text-[11px] text-slate-500">In Telugu, Hindi or English</p>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                          Title Transliterated (English)
                        </label>
                        <div className="flex items-center gap-1.5">
                          {titleTransliteratedNotification && (
                            <span className="text-[10px] text-emerald-400 flex items-center gap-0.5 animate-fadeIn">
                              <Check className="w-3 h-3" /> Transliterated
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={handleManualTransliterateTitle}
                            className="px-2 py-0.5 rounded text-[11px] font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 transition flex items-center gap-1"
                            title="Auto transliterate title to English"
                          >
                            <Wand2 className="w-3 h-3 text-amber-400" />
                            <span>Auto 🪄</span>
                          </button>
                        </div>
                      </div>
                      <input
                        type="text"
                        value={titleTransliterated}
                        onChange={(e) => {
                          setTitleTransliterated(e.target.value);
                          setAutoSyncTitle(false);
                        }}
                        placeholder="e.g. Yesu Naamam Athi Madhuram"
                        className="w-full px-4 py-3 bg-slate-950/70 border border-slate-700/80 focus:border-amber-500 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition-all"
                      />
                      <p className="mt-1 text-[11px] text-slate-500">Auto-transliterates from Telugu title</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                        Language
                      </label>
                      <select
                        value={language}
                        onChange={(e) => setLanguage(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-950/70 border border-slate-700/80 focus:border-amber-500 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition-all"
                      >
                        <option value="telugu">Telugu (తెలుగు)</option>
                        <option value="english">English</option>
                        <option value="hindi">Hindi (हिंदी)</option>
                      </select>
                      <p className="mt-1 text-[11px] text-slate-500">Primary song script</p>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                          Author / Composer (English)
                        </label>
                        <div className="flex items-center gap-1.5">
                          {authorEnglishNotification && (
                            <span className="text-[10px] text-emerald-400 flex items-center gap-0.5 animate-fadeIn">
                              <Check className="w-3 h-3" /> Transliterated
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={handleManualTransliterateAuthorEnglish}
                            className="px-2 py-0.5 rounded text-[11px] font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 transition flex items-center gap-1"
                            title="Auto transliterate from Telugu author"
                          >
                            <Wand2 className="w-3 h-3 text-amber-400" />
                            <span>Auto 🪄</span>
                          </button>
                        </div>
                      </div>
                      <input
                        type="text"
                        value={authorEnglish}
                        onChange={(e) => handleAuthorEnglishChange(e.target.value)}
                        placeholder="e.g. Dr. P. Satyanandam"
                        className="w-full px-4 py-3 bg-slate-950/70 border border-slate-700/80 focus:border-amber-500 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition-all"
                      />
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-[11px] text-slate-500">Auto-syncs with Telugu script</p>
                        <label className="flex items-center gap-1 text-[10px] text-slate-400 cursor-pointer select-none hover:text-slate-300">
                          <input
                            type="checkbox"
                            checked={autoSyncAuthor}
                            onChange={(e) => setAutoSyncAuthor(e.target.checked)}
                            className="w-3 h-3 rounded bg-slate-900 border-slate-700 text-amber-500 focus:ring-0"
                          />
                          <span>Live Sync ⇄</span>
                        </label>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                          Author (Telugu)
                        </label>
                        <div className="flex items-center gap-1.5">
                          {authorTeluguNotification && (
                            <span className="text-[10px] text-emerald-400 flex items-center gap-0.5 animate-fadeIn">
                              <Check className="w-3 h-3" /> Transliterated
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={handleManualTransliterateAuthorTelugu}
                            className="px-2 py-0.5 rounded text-[11px] font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 transition flex items-center gap-1"
                            title="Auto transliterate from English author"
                          >
                            <Wand2 className="w-3 h-3 text-amber-400" />
                            <span>Auto 🪄</span>
                          </button>
                        </div>
                      </div>
                      <input
                        type="text"
                        value={authorTelugu}
                        onChange={(e) => handleAuthorTeluguChange(e.target.value)}
                        placeholder="e.g. డా. పి. సత్యానందం"
                        className="w-full px-4 py-3 bg-slate-950/70 border border-slate-700/80 focus:border-amber-500 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition-all font-telugu"
                      />
                      <p className="mt-1 text-[11px] text-slate-500">Auto-syncs with English author</p>
                    </div>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setActiveTab('categories')}
                      className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-sm transition-all"
                    >
                      Next: Collections & Categories →
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 2: COLLECTIONS & CATEGORIES */}
              {activeTab === 'categories' && (
                <div className="space-y-6 animate-fadeIn">
                  
                  {/* Songbook / Collection Section */}
                  <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl">
                    <h4 className="text-sm font-bold text-white mb-1 flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-amber-400" />
                      Official Hymnal Collection
                    </h4>
                    <p className="text-xs text-slate-400 mb-4">
                      Link this song to one of the 8 official hymnal collections in the church.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-medium text-slate-300 mb-1.5">Collection Name</label>
                        <select
                          value={selectedSongbook}
                          onChange={(e) => setSelectedSongbook(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500"
                        >
                          {AVAILABLE_SONGBOOKS.map(b => (
                            <option key={b.slug} value={b.slug}>{b.title}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1.5">
                          Hymn # in Book (Optional)
                        </label>
                        <input
                          type="number"
                          value={songNumber}
                          onChange={(e) => setSongNumber(e.target.value)}
                          placeholder="e.g. 774"
                          className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500"
                        />
                        <p className="mt-1 text-[11px] text-slate-500 leading-tight">
                          Printed hymn number in this physical book.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Categories Multi-Select Chips */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                      Categories (Select all that apply)
                    </label>
                    <p className="text-xs text-slate-400 mb-3">
                      Songs will automatically appear when worshippers browse by these categories:
                    </p>

                    <div className="flex flex-wrap gap-2">
                      {AVAILABLE_CATEGORIES.map(cat => {
                        const isSelected = selectedCategories.includes(cat);
                        return (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => toggleCategory(cat)}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all flex items-center gap-1.5 ${
                              isSelected
                                ? 'bg-amber-500/20 border-amber-400 text-amber-300 shadow-sm'
                                : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3 text-amber-400" />}
                            <span>{cat}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="pt-2 flex justify-between">
                    <button
                      type="button"
                      onClick={() => setActiveTab('basics')}
                      className="px-4 py-2 bg-slate-800 text-slate-300 hover:text-white rounded-xl text-sm"
                    >
                      ← Back
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('lyrics')}
                      className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-sm"
                    >
                      Next: Lyrics & Chords →
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 3: LYRICS & CHORDS */}
              {activeTab === 'lyrics' && (
                <div className="space-y-6 animate-fadeIn">
                  {/* Native Lyrics */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                        Original Script Lyrics <span className="text-amber-400">*</span>
                      </label>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleInsertTag(setLyricsOriginal, lyricsOriginal, 'ప|| ')}
                          className="px-2 py-1 bg-slate-800 hover:bg-slate-750 text-amber-300 border border-slate-700 rounded text-[11px]"
                        >
                          + పల్లవి (ప||)
                        </button>
                        <button
                          type="button"
                          onClick={() => handleInsertTag(setLyricsOriginal, lyricsOriginal, 'చ|| 1. ')}
                          className="px-2 py-1 bg-slate-800 hover:bg-slate-750 text-amber-300 border border-slate-700 rounded text-[11px]"
                        >
                          + చరణం (చ|| 1.)
                        </button>
                        <button
                          type="button"
                          onClick={() => handleInsertTag(setLyricsOriginal, lyricsOriginal, 'అ||ప|| ')}
                          className="px-2 py-1 bg-slate-800 hover:bg-slate-750 text-amber-300 border border-slate-700 rounded text-[11px]"
                        >
                          + అనుపల్లవి (అ||ప||)
                        </button>
                      </div>
                    </div>
                    <textarea
                      rows={8}
                      value={lyricsOriginal}
                      onChange={(e) => handleLyricsOriginalChange(e.target.value)}
                      placeholder="Paste or type Telugu/Hindi/English lyrics line by line...&#10;ప|| నా ప్రియ యేసు రాజా...&#10;చ|| 1. ఘోరమైన పాపినై యుండగా..."
                      className="w-full p-4 bg-slate-950/80 border border-slate-700/80 focus:border-amber-500 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition-all font-telugu font-mono leading-relaxed"
                    />
                  </div>

                  {/* Transliterated Lyrics */}
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                          Transliterated English Lyrics (for dual-script view)
                        </label>
                        {lyricsTransliteratedNotification && (
                          <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1 animate-fadeIn">
                            <Check className="w-3 h-3" /> Transliterated!
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-1.5 text-[11px] text-slate-400 cursor-pointer hover:text-slate-200 select-none bg-slate-800/80 px-2 py-1 rounded-md border border-slate-700/60">
                          <input
                            type="checkbox"
                            checked={autoSyncLyrics}
                            onChange={(e) => setAutoSyncLyrics(e.target.checked)}
                            className="rounded bg-slate-900 border-slate-600 text-amber-500 focus:ring-0 w-3.5 h-3.5"
                          />
                          <span>Live Auto-Sync</span>
                        </label>
                        <button
                          type="button"
                          onClick={handleManualTransliterateLyrics}
                          className="px-2.5 py-1 bg-gradient-to-r from-amber-500/20 to-amber-600/20 hover:from-amber-500/30 hover:to-amber-600/30 text-amber-300 border border-amber-500/40 rounded text-[11px] font-medium transition flex items-center gap-1 shadow-sm"
                          title="Auto transliterate original script lyrics into English phonetics"
                        >
                          <Wand2 className="w-3 h-3 text-amber-400" />
                          <span>Generate Transliteration 🪄</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleInsertTag(setLyricsTransliterated, lyricsTransliterated, 'Pa|| ')}
                          className="px-2 py-1 bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700 rounded text-[11px]"
                        >
                          + Pa||
                        </button>
                        <button
                          type="button"
                          onClick={() => handleInsertTag(setLyricsTransliterated, lyricsTransliterated, 'Cha|| 1. ')}
                          className="px-2 py-1 bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700 rounded text-[11px]"
                        >
                          + Cha|| 1.
                        </button>
                      </div>
                    </div>
                    <textarea
                      rows={8}
                      value={lyricsTransliterated}
                      onChange={(e) => {
                        setLyricsTransliterated(e.target.value);
                        setAutoSyncLyrics(false);
                      }}
                      placeholder="Naa prathi otamilo dhairyamu neevenayya...&#10;Matalukandani kanneetiki samadhanam neevenayya...&#10;Automatically transliterates as you type or paste Telugu lyrics above!"
                      className="w-full p-4 bg-slate-950/80 border border-slate-700/80 focus:border-amber-500 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition-all font-mono leading-relaxed"
                    />
                  </div>

                  {/* Chords Sheet (Optional) */}
                  <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Guitar className="w-4 h-4 text-amber-400" />
                        <h4 className="text-sm font-bold text-white">Chords Sheet (Optional)</h4>
                      </div>
                      <span className="text-[11px] text-slate-400">Supports live transposition in app</span>
                    </div>

                    <textarea
                      rows={5}
                      value={chordsText}
                      onChange={(e) => setChordsText(e.target.value)}
                      placeholder="Em           C         D          Em&#10;Naa Priya Yesu Raajaa - Ninne Ne Kolichedanu"
                      className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl text-amber-300 placeholder-slate-600 text-xs font-mono leading-relaxed focus:outline-none focus:border-amber-500"
                    />

                    <div>
                      <label className="block text-[11px] font-medium text-slate-400 mb-1">Chord Credits</label>
                      <input
                        type="text"
                        value={chordCredits}
                        onChange={(e) => setChordCredits(e.target.value)}
                        placeholder="Jesus Heals Fellowship"
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  <div className="pt-2 flex justify-between">
                    <button
                      type="button"
                      onClick={() => setActiveTab('categories')}
                      className="px-4 py-2 bg-slate-800 text-slate-300 hover:text-white rounded-xl text-sm"
                    >
                      ← Back
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('media')}
                      className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-sm"
                    >
                      Next: Media & PPT →
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 4: MEDIA & PPT */}
              {activeTab === 'media' && (
                <div className="space-y-6 animate-fadeIn">
                  
                  {/* YouTube Video Link */}
                  <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-3">
                    <div className="flex items-center gap-2">
                      <Video className="w-4 h-4 text-red-400" />
                      <h4 className="text-sm font-bold text-white">YouTube Video Playback (Optional)</h4>
                    </div>
                    <p className="text-xs text-slate-400">
                      Paste full YouTube URL (e.g. <code className="text-slate-300">https://www.youtube.com/watch?v=dQw4w9WgXcQ</code>) or video ID.
                    </p>
                    <input
                      type="text"
                      value={youtubeInput}
                      onChange={(e) => setYoutubeInput(e.target.value)}
                      placeholder="e.g. https://www.youtube.com/watch?v=wcYQEnifUI0 or wcYQEnifUI0"
                      className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500"
                    />

                    {youtubeInput && extractYoutubeId(youtubeInput) && (
                      <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-950/30 p-2.5 rounded-lg border border-emerald-500/20">
                        <Check className="w-3.5 h-3.5" />
                        <span>Valid YouTube ID detected: <strong>{extractYoutubeId(youtubeInput)}</strong></span>
                      </div>
                    )}
                  </div>

                  {/* PowerPoint Generation & URL */}
                  <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-amber-400" />
                        <h4 className="text-sm font-bold text-white">PowerPoint (PPT) Church Slides</h4>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        100% Automated
                      </span>
                    </div>

                    <div className="p-3 bg-emerald-950/25 border border-emerald-500/20 rounded-xl text-xs text-emerald-300/90 leading-relaxed">
                      ✨ <strong>Zero Admin Effort:</strong> Church PowerPoint (.pptx) widescreen 16:9 slides with high-contrast dual-script lyrics (Telugu + English) and chorus cues are generated automatically on demand directly in the browser! You <strong>do not need to upload or create</strong> any PPT file.
                    </div>

                    <div className="pt-1">
                      <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                        Custom Cloud PPT URL (Optional Override)
                      </label>
                      <input
                        type="url"
                        value={pptUrl}
                        onChange={(e) => setPptUrl(e.target.value)}
                        placeholder="Leave blank for auto-generation, or paste custom .pptx URL"
                        className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500 placeholder:text-slate-600"
                      />
                    </div>
                  </div>

                  {/* Pin to Landing Page Option */}
                  <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Pin className="w-4 h-4 text-amber-400 fill-amber-400/30" />
                        <h4 className="text-sm font-bold text-white">Pin to Landing Page</h4>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={pinToLanding}
                          onChange={(e) => setPinToLanding(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
                      </label>
                    </div>

                    <p className="text-xs text-slate-400">
                      Highlight this song prominently at the top of the church landing page with an order number (#1, #2...) for today's service.
                    </p>

                    {pinToLanding && (
                      <div className="pt-1 animate-fadeIn">
                        <label className="block text-xs font-semibold text-amber-400 uppercase tracking-wider mb-1">
                          Worship Order / Pin Number
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={pinNumberToSet}
                          onChange={(e) => setPinNumberToSet(e.target.value)}
                          placeholder="e.g. 1 (Leave empty for next available)"
                          className="w-full px-3.5 py-2 bg-slate-900 border border-amber-500/50 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    )}
                  </div>

                  {/* Review Summary */}
                  <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-xs space-y-1.5 text-slate-300">
                    <p className="font-bold text-amber-400 text-sm mb-1 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4" /> Ready to Publish
                    </p>
                    <p>• <strong>Title:</strong> {title || '(No title entered)'}</p>
                    <p>• <strong>Language:</strong> {language.toUpperCase()}</p>
                    <p>• <strong>Categories:</strong> {selectedCategories.join(', ')}</p>
                    <p>• <strong>Collection:</strong> {selectedSongbook ? AVAILABLE_SONGBOOKS.find(b => b.slug === selectedSongbook)?.title : 'General / None'}</p>
                  </div>

                  <div className="pt-2 flex justify-between">
                    <button
                      type="button"
                      onClick={() => setActiveTab('lyrics')}
                      className="px-4 py-2 bg-slate-800 text-slate-300 hover:text-white rounded-xl text-sm"
                    >
                      ← Back
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-6 py-3 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-bold rounded-xl text-sm shadow-xl shadow-amber-500/20 flex items-center gap-2 disabled:opacity-50"
                    >
                      {isSubmitting ? (
                        <>
                          <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                          <span>Publishing Song...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4 stroke-[3]" />
                          <span>Publish Song Now</span>
                        </>
                      )}
                    </button>
                  </div>

                </div>
              )}

            </form>
          </>
        )}

      </div>
    </div>
  );
}
