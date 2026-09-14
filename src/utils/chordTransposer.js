// Chord Transposition Engine

const SHARP_SCALE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_SCALE  = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

const NORMALIZE_NOTE = {
  'B#': 'C',
  'E#': 'F',
  'Cb': 'B',
  'Fb': 'E'
};

export function transposeChord(chordToken, semitones, preferFlats = false) {
  if (!chordToken || semitones === 0) return chordToken;

  // Regex to match root note, modifier, and optional bass note
  const chordRegex = /^([A-G][b#]?)(.*?)(\/([A-G][b#]?))?$/;
  const match = chordToken.match(chordRegex);
  if (!match) return chordToken;

  let [, root, modifier, , bass] = match;

  const transposeNote = (note) => {
    let normalized = NORMALIZE_NOTE[note] || note;
    let index = SHARP_SCALE.indexOf(normalized);
    if (index === -1) index = FLAT_SCALE.indexOf(normalized);
    if (index === -1) return note;

    let newIndex = (index + semitones) % 12;
    if (newIndex < 0) newIndex += 12;

    const scale = preferFlats ? FLAT_SCALE : SHARP_SCALE;
    return scale[newIndex];
  };

  const newRoot = transposeNote(root);
  const newBass = bass ? `/${transposeNote(bass)}` : '';

  return `${newRoot}${modifier}${newBass}`;
}

export function isChordLine(line) {
  if (!line || typeof line !== 'string') return false;
  const trimmed = line.trim();
  if (!trimmed) return false;

  // Tokenize by spaces
  const tokens = trimmed.split(/\s+/);
  if (tokens.length === 0) return false;

  const chordRegex = /^[A-G][b#]?(?:m|maj|min|dim|aug|sus|add|\d)*(?:\/[A-G][b#]?)?$/;
  let chordMatches = 0;

  for (const t of tokens) {
    // Strip surrounding brackets or parentheses
    const cleanToken = t.replace(/^[\[(]/, '').replace(/[\])]$/, '');
    if (chordRegex.test(cleanToken)) {
      chordMatches++;
    }
  }

  // If more than 60% of non-whitespace tokens look like chords, it is a chord line
  return chordMatches / tokens.length >= 0.5;
}

export function transposeChordLine(line, semitones, preferFlats = false) {
  if (semitones === 0 || !line) return line;

  // Replace each chord token while preserving exact space positioning
  const chordTokenRegex = /([A-G][b#]?(?:m|maj|min|dim|aug|sus|add|\d)*(?:\/[A-G][b#]?)?)/g;

  return line.replace(chordTokenRegex, (match) => {
    return transposeChord(match, semitones, preferFlats);
  });
}

export function transposeChordSheet(lines, semitones, preferFlats = false) {
  if (!Array.isArray(lines) || semitones === 0) return lines;

  return lines.map((line) => {
    if (isChordLine(line)) {
      return transposeChordLine(line, semitones, preferFlats);
    }
    return line;
  });
}
