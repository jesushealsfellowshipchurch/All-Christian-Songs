// Instant Client-side Search and Filter Engine

export function filterSongs(songs, { query = '', language = 'all', filterType = 'all', songbook = null, alphabet = null }) {
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

    // 4. Alphabetical Filter
    if (alphabet) {
      if (alphabet === '#') {
        const firstChar = (song.tr || song.t || '').charAt(0).toUpperCase();
        if (/[A-Z]/.test(firstChar)) return false;
      } else {
        const firstCharEng = (song.tr || '').charAt(0).toUpperCase();
        const firstCharOrig = (song.alpha || song.t || '').charAt(0);
        if (firstCharEng !== alphabet && firstCharOrig !== alphabet) {
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
}
