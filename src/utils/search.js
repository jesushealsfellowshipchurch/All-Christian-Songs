// Instant Client-side Search and Filter Engine

export function filterSongs(songs, { query = '', language = 'all', filterType = 'all', songbook = null, alphabet = null, category = null }) {
  if (!songs || !Array.isArray(songs)) return [];

  const cleanQuery = query.trim().toLowerCase();
  const searchTokens = cleanQuery ? cleanQuery.split(/\s+/).filter(Boolean) : [];

  return songs.filter((song) => {
    // 1. Language Filter
    if (language !== 'all' && song.lang !== language) {
      return false;
    }

    // 2. Feature Filter
    if (filterType === 'chords' && !song.chords) return false;
    if (filterType === 'video' && !song.video) return false;
    if (filterType === 'ppt' && !song.ppt) return false;

    // 3. Songbook Filter
    if (songbook) {
      const match = song.books && song.books.some(b => {
        if (typeof b === 'string') return b.toLowerCase().includes(songbook.toLowerCase());
        if (typeof b === 'object' && b) {
          const key = (b.book || b.slug || b.name || '').toLowerCase();
          return key.includes(songbook.toLowerCase());
        }
        return false;
      });
      if (!match) return false;
    }

    // 3.5. Category Filter
    if (category) {
      const target = category.toLowerCase().replace(/ songs$/, '').trim();
      const hasCat = song.cats && song.cats.some(c => {
        const clean = c.toLowerCase().replace(/ songs$/, '').trim();
        return clean === target || clean.includes(target) || target.includes(clean);
      });
      if (!hasCat) return false;
    }

    // 4. Alphabetical Filter (Supports both Telugu and English letters)
    if (alphabet && alphabet !== 'ALL') {
      if (alphabet === '#') {
        const firstChar = (song.tr || song.t || '').trim().replace(/^["'‘“]/, '').charAt(0).toUpperCase();
        if (/[A-Z]/.test(firstChar)) return false;
      } else if (alphabet.charCodeAt(0) > 127) {
        // Non-ASCII (Telugu script letter e.g. అ, ఆ, క, ప, etc.)
        const cleanTitle = (song.t || '').trim().replace(/^["'‘“]/, '');
        const firstChar = cleanTitle.charAt(0);
        if (firstChar !== alphabet && song.alpha !== alphabet) {
          return false;
        }
      } else {
        // English / Latin letter (e.g. A, B, C...)
        const firstCharEng = (song.tr || song.t || '').trim().replace(/^["'‘“]/, '').charAt(0).toUpperCase();
        if (firstCharEng !== alphabet) {
          return false;
        }
      }
    }

    // 5. Query Search
    if (searchTokens.length > 0) {
      const targetString = (song.search || `${song.t} ${song.tr} ${song.auth || ''}`).toLowerCase();
      // Match all search tokens
      const matchesAll = searchTokens.every(token => targetString.includes(token));
      if (!matchesAll) return false;
    }

    return true;
  });

  // Always give first preference to Telugu songs in catalog and filtered views
  return filtered.sort((a, b) => {
    const aTe = a.lang === 'telugu' ? 1 : 0;
    const bTe = b.lang === 'telugu' ? 1 : 0;
    return bTe - aTe;
  });
}

/**
 * Fast, accurate suggestion generator for live autocomplete dropdowns
 * Returns up to maxResults high-confidence matched songs, with first preference to Telugu songs
 */
export function getSongSuggestions(songs, query, maxResults = 8) {
  if (!query || !query.trim() || !songs || songs.length === 0) return [];
  const cleanQ = query.trim().toLowerCase();
  const tokens = cleanQ.split(/\s+/).filter(Boolean);
  const isNum = /^\d+$/.test(cleanQ);
  const qNum = isNum ? parseInt(cleanQ, 10) : null;
  
  const matches = [];
  for (let i = 0; i < songs.length; i++) {
    const s = songs[i];
    let score = 0;
    
    // Exact or prefix song index/number
    if (isNum) {
      if (s.id === qNum || String(s.id) === cleanQ || (s.no && String(s.no) === cleanQ)) {
        score += 1000;
      } else if (String(s.id).startsWith(cleanQ) || (s.no && String(s.no).startsWith(cleanQ))) {
        score += 500;
      }
    }
    
    const titleTe = (s.t || '').toLowerCase();
    const titleTr = (s.tr || '').toLowerCase();
    const author = (s.auth || '').toLowerCase();
    const searchSnippet = (s.search || '').toLowerCase();
    
    if (titleTe === cleanQ || titleTr === cleanQ) {
      score += 800; // Exact title match
    } else if (titleTe.startsWith(cleanQ) || titleTr.startsWith(cleanQ)) {
      score += 400; // Starts with query
    } else if (titleTe.includes(cleanQ) || titleTr.includes(cleanQ)) {
      score += 200; // Contains query
    } else if (author.includes(cleanQ)) {
      score += 100; // Author match
    } else if (searchSnippet.includes(cleanQ)) {
      score += 50; // Lyrics match
    }
    
    // Multi-token match across all fields
    if (tokens.length > 1) {
      const combined = `${titleTe} ${titleTr} ${author} ${searchSnippet}`;
      if (tokens.every(t => combined.includes(t))) {
        score += 150;
      }
    }
    
    // First preference to Telugu songs in suggestions
    if (score > 0 && s.lang === 'telugu') {
      score += 350;
    }
    
    if (score > 0) {
      matches.push({ song: s, score });
    }
  }
  
  matches.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const aTe = a.song.lang === 'telugu' ? 1 : 0;
    const bTe = b.song.lang === 'telugu' ? 1 : 0;
    return bTe - aTe;
  });
  return matches.slice(0, maxResults).map(m => m.song);
}

