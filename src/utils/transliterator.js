/**
 * Universal Reusable Transliteration Engine
 * 
 * Provides:
 * 1. `BaseTransliterator`: Extensible base class for any language transliterator.
 * 2. `TeluguTransliterator`: Telugu -> English Roman script (Christian lyrics & hymnal phonetics).
 * 3. `EnglishToTeluguTransliterator`: English -> Telugu script (Phonetic name, titles, & words conversion).
 * 4. `TransliteratorService`: Universal service for form inputs, lyrics, titles, and author fields.
 */

export class BaseTransliterator {
  constructor(language = 'generic') {
    this.language = language;
  }

  /**
   * Transliterate a single token or word
   */
  transliterateWord(word, options = {}) {
    return word;
  }

  /**
   * Transliterate multiline or inline text
   */
  transliterate(text, options = {}) {
    throw new Error('transliterate() must be implemented by subclass');
  }

  /**
   * Helper to capitalize the first alphabetic character of a sentence/line
   */
  capitalizeSentence(str) {
    if (!str) return '';
    return str.replace(/^([^a-zA-Z]*)([a-z])/, (_, prefix, char) => prefix + char.toUpperCase());
  }

  /**
   * Check if text contains characters from this language's script
   */
  hasScript(text) {
    return false;
  }
}

/**
 * High-precision Telugu -> English Roman Script Transliterator
 * Built specifically for Telugu Christian Worship songs, verses, and titles.
 */
export class TeluguTransliterator extends BaseTransliterator {
  constructor() {
    super('telugu');
  }

  static VOWELS = {
    '\u0C05': 'a',
    '\u0C06': 'aa',
    '\u0C07': 'i',
    '\u0C08': 'ee',
    '\u0C09': 'u',
    '\u0C0A': 'oo',
    '\u0C0B': 'ru',
    '\u0C0C': 'lu',
    '\u0C0E': 'e',
    '\u0C0F': 'e',
    '\u0C10': 'ai',
    '\u0C12': 'o',
    '\u0C13': 'o',
    '\u0C14': 'au'
  };

  static MATRAS = {
    '\u0C3E': 'a',   // 'ా'
    '\u0C3F': 'i',   // 'ి'
    '\u0C40': 'ee',  // 'ీ'
    '\u0C41': 'u',   // 'ు'
    '\u0C42': 'u',   // 'ూ'
    '\u0C43': 'ru',  // 'ృ'
    '\u0C44': 'roo', // 'ౄ'
    '\u0C46': 'e',   // 'ె'
    '\u0C47': 'e',   // 'ే'
    '\u0C48': 'ai',  // 'ై'
    '\u0C4A': 'o',   // 'ొ'
    '\u0C4B': 'o',   // 'ో'
    '\u0C4C': 'au'   // 'ౌ'
  };

  static CONSONANTS = {
    '\u0C15': 'k',
    '\u0C16': 'kh',
    '\u0C17': 'g',
    '\u0C18': 'gh',
    '\u0C19': 'ng',
    '\u0C1A': 'ch',
    '\u0C1B': 'chh',
    '\u0C1C': 'j',
    '\u0C1D': 'jh',
    '\u0C1E': 'ny',
    '\u0C1F': 't',
    '\u0C20': 'th',
    '\u0C21': 'd',
    '\u0C22': 'dh',
    '\u0C23': 'n',
    '\u0C24': 't',
    '\u0C25': 'th',
    '\u0C26': 'd',
    '\u0C27': 'dh',
    '\u0C28': 'n',
    '\u0C2A': 'p',
    '\u0C2B': 'ph',
    '\u0C2C': 'b',
    '\u0C2D': 'bh',
    '\u0C2E': 'm',
    '\u0C2F': 'y',
    '\u0C30': 'r',
    '\u0C31': 'r',
    '\u0C32': 'l',
    '\u0C33': 'l',
    '\u0C35': 'v',
    '\u0C36': 'sh',
    '\u0C37': 'sh',
    '\u0C38': 's',
    '\u0C39': 'h'
  };

  static DIGITS = {
    '\u0C66': '0',
    '\u0C67': '1',
    '\u0C68': '2',
    '\u0C69': '3',
    '\u0C6A': '4',
    '\u0C6B': '5',
    '\u0C6C': '6',
    '\u0C6D': '7',
    '\u0C6E': '8',
    '\u0C6F': '9'
  };

  static VIRAMA = '\u0C4D';
  static ANUSVARA = '\u0C02';
  static VISARGA = '\u0C03';

  // Words with canonical song spellings
  static SPECIAL_WORDS = {
    'నా': 'naa',
    'నీవు': 'neevu',
    'నీవేనయ్య': 'neevenayya',
    'యేసయ్యా': 'Yesayya',
    'యేసయా': 'Yesayaa',
    'యేసు': 'Yesu',
    'యేసుని': 'Yesuni',
    'యేసుతో': 'Yesutho',
    'యెహోవా': 'Yehovaa',
    'యెహోవను': 'Yehovanu',
    'హల్లెలూయా': 'Hallelooyaa',
    'హల్లెలూయ': 'Hallelooya',
    'ప్రతి': 'prathi',
    'కథలో': 'kathalo',
    'కథ': 'katha',
    'దాత': 'daata',
    'జీవదాత': 'jeevadaatha',
    'ప్రాణనాథ': 'praananaatha',
    'నాథ': 'naatha',
    'సన్నిధి': 'sannidhi',
    'వీడకయ్యా': 'vidakayya',
    'వీడని': 'viidani',
    'ఎన్నటికీ': 'ennatiki',
    'ఆశీర్వాదమే': 'aasheervaadame',
    'ఆశీర్వాదం': 'aasheervaadam',
    'కోల్పోయినా': 'kolpoyinaa',
    'అత్యల్ప': 'atylpa',
    'నీదీ': 'needee',
    'నాదీ': 'naadi',
    'నీది': 'needi',
    'నాతో': 'naatho',
    'కాయుమయ్య': 'kaayumayya',
    'వుండనీ': 'vundani',
    'భారమే': 'bhaarame',
    'కడదాకా': 'kadadaaka',
    'మేలుగా': 'meluga',
    'మలిచావయ్య': 'malichavayya',
    // Author titles & names
    'డా.': 'Dr.',
    'డా': 'Dr.',
    'పాస్టర్': 'Pastor',
    'పాస్టరు': 'Pastor',
    'రెవ.': 'Rev.',
    'రెవ': 'Rev.',
    'బ్రదర్': 'Brother',
    'సిస్టర్': 'Sister',
    'బిషప్': 'Bishop',
    'ఫాదర్': 'Father',
    'సువార్తీకుడు': 'Evangelist',
    'జాన్': 'John',
    'పాల్': 'Paul',
    'పీటర్': 'Peter',
    'డేవిడ్': 'David',
    'జోసెఫ్': 'Joseph',
    'శామ్యూల్': 'Samuel',
    'దానియేలు': 'Daniel',
    'మోషే': 'Moses',
    'అబ్రాహాము': 'Abraham',
    'స్టీఫెన్': 'Stephen',
    'జేమ్స్': 'James',
    'మత్తయి': 'Matthew',
    'మార్కు': 'Mark',
    'లూకా': 'Luke',
    'సత్యానందం': 'Satyanandam',
    'సత్యానంద్': 'Satyanand',
    'ఆనంద్': 'Anand',
    'ప్రసాద్': 'Prasad',
    'రాజు': 'Raju',
    'రావు': 'Rao',
    'కుమార్': 'Kumar',
    'రెడ్డి': 'Reddy',
    'బాబు': 'Babu',
    'యేసుపాదం': 'Yesupadam',
    'దాస్': 'Das',
    'కిరణ్': 'Kiran',
    'కవిత': 'Kavitha',
    'కృప': 'Krupa',
    'దేవ': 'Deva',
    'షెర్విన్': 'Sherwin',
    'హెప్సి': 'Hepsi',
    'శాస్త్రి': 'Shastry',
    'శారద': 'Sarada',
    'గ్రేస్': 'Grace',
    'మేరీ': 'Mary',
    'రూత్': 'Ruth',
    'ఎస్తేరు': 'Esther',
    // Single-letter initials (both with and without dot)
    'ఎ': 'A', 'ఎ.': 'A.',
    'బి': 'B', 'బి.': 'B.',
    'సి': 'C', 'సి.': 'C.',
    'డి': 'D', 'డి.': 'D.',
    'ఇ': 'E', 'ఇ.': 'E.',
    'ఎఫ్': 'F', 'ఎఫ్.': 'F.',
    'జి': 'G', 'జి.': 'G.',
    'హెచ్': 'H', 'హెచ్.': 'H.',
    'ఐ': 'I', 'ఐ.': 'I.',
    'జె': 'J', 'జె.': 'J.',
    'కె': 'K', 'కె.': 'K.',
    'ఎల్': 'L', 'ఎల్.': 'L.',
    'ఎం': 'M', 'ఎం.': 'M.',
    'ఎన్': 'N', 'ఎన్.': 'N.',
    'ఒ': 'O', 'ఒ.': 'O.',
    'పి': 'P', 'పి.': 'P.',
    'క్యూ': 'Q', 'క్యూ.': 'Q.',
    'ఆర్': 'R', 'ఆర్.': 'R.',
    'ఎస్': 'S', 'ఎస్.': 'S.',
    'టి': 'T', 'టి.': 'T.',
    'యు': 'U', 'యు.': 'U.',
    'వి': 'V', 'వి.': 'V.',
    'డబ్ల్యూ': 'W', 'డబ్ల్యూ.': 'W.',
    'ఎక్స్': 'X', 'ఎక్స్.': 'X.',
    'వై': 'Y', 'వై.': 'Y.',
    'జెడ్': 'Z', 'జెడ్.': 'Z.'
  };

  static getAnusvaraSound(nextChar) {
    if (!nextChar) return 'm';
    const nConsonants = [
      '\u0C15', '\u0C16', '\u0C17', '\u0C18', // k, kh, g, gh (e.g. Sanghamu, Shrungamu, Rangu, Pongu)
      '\u0C1A', '\u0C1B', '\u0C1C', '\u0C1D', // ch, chh, j, jh (e.g. Manchu, Anjali)
      '\u0C1F', '\u0C20', '\u0C21', '\u0C22', '\u0C23', // t, th, d, dh, n (e.g. Gunde, Kante)
      '\u0C24', '\u0C25', '\u0C26', '\u0C27', '\u0C28'  // t, th, d, dh, n (e.g. Santhasamu, Sundara, Bandhamu)
    ];
    if (nConsonants.includes(nextChar)) return 'n';
    return 'm';
  }

  hasScript(text) {
    return /[\u0C00-\u0C7F]/.test(text || '');
  }

  transliterateWord(word) {
    if (!word) return '';

    const cleanWord = word.replace(/^[^\u0C00-\u0C7F.]+|[^\u0C00-\u0C7F.]+$/g, '');
    if (TeluguTransliterator.SPECIAL_WORDS[cleanWord]) {
      return word.replace(cleanWord, TeluguTransliterator.SPECIAL_WORDS[cleanWord]);
    }

    let result = '';
    const len = word.length;

    for (let i = 0; i < len; i++) {
      const char = word[i];
      const next = i + 1 < len ? word[i + 1] : null;
      const nextNext = i + 2 < len ? word[i + 2] : null;

      // Telugu Digits (౦ - ౯)
      if (TeluguTransliterator.DIGITS[char]) {
        result += TeluguTransliterator.DIGITS[char];
        continue;
      }

      // Avagraha (ఽ)
      if (char === '\u0C3D') {
        result += "'";
        continue;
      }

      // Independent Vowels
      if (TeluguTransliterator.VOWELS[char]) {
        let v = TeluguTransliterator.VOWELS[char];
        if (i === 0 && (char === '\u0C0E' || char === '\u0C0F') && (next === '\u0C38' || next === '\u0C39')) {
          v = 'Ye';
        }
        result += v;
        continue;
      }

      // Special Conjunct: జ్ఞ (Gna)
      if (char === '\u0C1C' && next === TeluguTransliterator.VIRAMA && nextNext === '\u0C1E') {
        let gna = 'gn';
        i += 2;
        if (i + 1 < len && TeluguTransliterator.MATRAS[word[i + 1]]) {
          gna += TeluguTransliterator.MATRAS[word[i + 1]];
          i++;
        } else {
          gna += 'a';
        }
        result += gna;
        continue;
      }

      // Consonants
      if (TeluguTransliterator.CONSONANTS[char]) {
        let c = TeluguTransliterator.CONSONANTS[char];

        // Dental 'త' vs retroflex 'ట': In clusters use 't', in open syllables use 'th'
        if (char === '\u0C24') {
          const prev = i > 0 ? word[i - 1] : null;
          if (prev === TeluguTransliterator.VIRAMA || next === TeluguTransliterator.VIRAMA) {
            c = 't';
          } else {
            c = 'th';
          }
        }

        // Followed by Virama (్)
        if (next === TeluguTransliterator.VIRAMA) {
          if (nextNext && TeluguTransliterator.CONSONANTS[nextNext]) {
            if (char === '\u0C36' && nextNext === '\u0C35') {
              result += 'shw';
              i += 2;
              if (i + 1 < len && TeluguTransliterator.MATRAS[word[i + 1]]) {
                result += TeluguTransliterator.MATRAS[word[i + 1]];
                i++;
              } else {
                result += 'a';
              }
              continue;
            }

            if (char === '\u0C24' && nextNext === '\u0C2F') {
              c = 't';
            }
            result += c;
            i++;
            continue;
          } else {
            result += c;
            i++;
            continue;
          }
        }

        // Followed by Vowel Sign (Matra)
        if (next && TeluguTransliterator.MATRAS[next]) {
          let m = TeluguTransliterator.MATRAS[next];

          if (next === '\u0C3E') {
            if (len <= 3 || i + 2 >= len) {
              m = 'aa';
            } else {
              m = 'a';
            }
          }

          result += c + m;
          i++;
          continue;
        }

        // Followed by Anusvara (ం) directly
        if (next === TeluguTransliterator.ANUSVARA) {
          const nasal = TeluguTransliterator.getAnusvaraSound(nextNext);
          result += c + 'a' + nasal;
          i++;
          continue;
        }

        // Default inherent 'a'
        result += c + 'a';
        continue;
      }

      // Standalone Anusvara (ం)
      if (char === TeluguTransliterator.ANUSVARA) {
        result += TeluguTransliterator.getAnusvaraSound(next);
        continue;
      }

      // Standalone Visarga (ః)
      if (char === TeluguTransliterator.VISARGA) {
        result += 'h';
        continue;
      }

      // Punctuation danda
      if (char === '\u0964' || char === '।') {
        result += '|';
        continue;
      }
      if (char === '\u0965' || char === '॥') {
        result += '||';
        continue;
      }

      // Pass-through other characters
      result += char;
    }

    return result;
  }

  transliterate(text, options = {}) {
    if (!text) return '';
    const lines = text.split('\n');
    const capitalize = options.capitalize !== false;

    const transliteratedLines = lines.map(line => {
      if (!line.trim()) return line;

      const leadingSpace = line.match(/^\s*/)[0];
      const trailingSpace = line.match(/\s*$/)[0];
      const trimmed = line.trim();

      let content = trimmed;
      let prefix = '';
      let suffix = '';

      // Recognize hymn markers like ప||, చ|| 1., అ||ప||, పల్లవి:, చరణం:
      if (/^ప\|\|\s*/.test(content)) {
        prefix = 'Pa|| ';
        content = content.replace(/^ప\|\|\s*/, '');
      } else if (/^చ\|\|\s*([0-9\u0C66-\u0C6F]+)?\.?\s*/.test(content)) {
        content = content.replace(/^చ\|\|\s*([0-9\u0C66-\u0C6F]+)?\.?\s*/, (_, num) => {
          const n = num ? num.replace(/[\u0C66-\u0C6F]/g, d => TeluguTransliterator.DIGITS[d] || d) : '';
          prefix = `Cha|| ${n ? n + '. ' : ''}`;
          return '';
        });
      } else if (/^అ\|\|ప\|\|\s*/.test(content)) {
        prefix = 'Anu.Pa|| ';
        content = content.replace(/^అ\|\|ప\|\|\s*/, '');
      } else if (/^పల్లవి:\s*/i.test(content)) {
        prefix = 'Pallavi: ';
        content = content.replace(/^పల్లవి:\s*/i, '');
      } else if (/^చరణం:\s*/i.test(content)) {
        prefix = 'Charanam: ';
        content = content.replace(/^చరణం:\s*/i, '');
      } else if (/^అనుపల్లవి:\s*/i.test(content)) {
        prefix = 'Anupallavi: ';
        content = content.replace(/^అనుపల్లవి:\s*/i, '');
      }

      const refrainMatch = content.match(/^([।|॥]+)(.*?)([।|॥]+)$/);
      if (refrainMatch) {
        prefix = '|';
        content = refrainMatch[2].trim();
        suffix = '|';
      }

      const words = content.split(/(\s+|[.,!?:;()\-।॥]+)/);
      const transliteratedWords = words.map(token => {
        if (/^[\s.,!?:;()\-।॥]+$/.test(token)) {
          return token.replace(/[।]/g, '|').replace(/[॥]/g, '||');
        }
        return this.transliterateWord(token);
      });

      let resLine = prefix + transliteratedWords.join('') + suffix;
      resLine = resLine.replace(/\.{2,}/g, '.').replace(/\s+\./g, '.');
      if (capitalize) {
        resLine = this.capitalizeSentence(resLine);
      }

      return leadingSpace + resLine + trailingSpace;
    });

    return transliteratedLines.join('\n');
  }
}

/**
 * English (Roman) -> Telugu Script Phonetic Transliterator
 * Specifically tuned for composer names, pastor titles, Christian vocabulary, and initials.
 */
export class EnglishToTeluguTransliterator extends BaseTransliterator {
  constructor() {
    super('english_to_telugu');
  }

  static DICTIONARY = {
    'dr': 'డా.',
    'dr.': 'డా.',
    'rev': 'రెవ.',
    'rev.': 'రెవ.',
    'pastor': 'పాస్టర్',
    'pastor.': 'పాస్టర్',
    'pr': 'పాస్టర్',
    'pr.': 'పాస్టర్',
    'ps': 'పాస్టర్',
    'ps.': 'పాస్టర్',
    'brother': 'బ్రదర్',
    'bro': 'బ్రదర్',
    'bro.': 'బ్రదర్',
    'sister': 'సిస్టర్',
    'sis': 'సిస్టర్',
    'sis.': 'సిస్టర్',
    'bishop': 'బిషప్',
    'evangelist': 'సువార్తీకుడు',
    'john': 'జాన్',
    'paul': 'పాల్',
    'peter': 'పీటర్',
    'david': 'డేవిడ్',
    'joseph': 'జోసెఫ్',
    'samuel': 'శామ్యూల్',
    'daniel': 'దానియేలు',
    'moses': 'మోషే',
    'abraham': 'అబ్రాహాము',
    'stephen': 'స్టీఫెన్',
    'james': 'జేమ్స్',
    'matthew': 'మత్తయి',
    'mark': 'మార్కు',
    'luke': 'లూకా',
    'satyanandam': 'సత్యానందం',
    'satyanand': 'సత్యానంద్',
    'father': 'ఫాదర్',
    'fr': 'ఫాదర్',
    'fr.': 'ఫాదర్',
    'babu': 'బాబు',
    'yesupadam': 'యేసుపాదం',
    'das': 'దాస్',
    'dass': 'దాస్',
    'kiran': 'కిరణ్',
    'kavitha': 'కవిత',
    'krupa': 'కృప',
    'deva': 'దేవ',
    'anand': 'ఆనంద్',
    'prasad': 'ప్రసాద్',
    'raju': 'రాజు',
    'rao': 'రావు',
    'kumar': 'కుమార్',
    'reddy': 'రెడ్డి',
    'yesu': 'యేసు',
    'yesayya': 'యేసయ్య',
    'sherwin': 'షెర్విన్',
    'hepsi': 'హెప్సి',
    'shastry': 'శాస్త్రి',
    'sastry': 'శాస్త్రి',
    'sarada': 'శారద',
    'grace': 'గ్రేస్',
    'mary': 'మేరీ',
    'ruth': 'రూత్',
    'esther': 'ఎస్తేరు'
  };

  static INITIALS = {
    'a': 'ఎ',
    'b': 'బి',
    'c': 'సి',
    'd': 'డి',
    'e': 'ఇ',
    'f': 'ఎఫ్',
    'g': 'జి',
    'h': 'హెచ్',
    'i': 'ఐ',
    'j': 'జె',
    'k': 'కె',
    'l': 'ఎల్',
    'm': 'ఎం',
    'n': 'ఎన్',
    'o': 'ఒ',
    'p': 'పి',
    'q': 'క్యూ',
    'r': 'ఆర్',
    's': 'ఎస్',
    't': 'టి',
    'u': 'యు',
    'v': 'వి',
    'w': 'డబ్ల్యూ',
    'x': 'ఎక్స్',
    'y': 'వై',
    'z': 'జెడ్'
  };

  static INDEPENDENT_VOWELS = {
    'aa': '\u0C06',
    'a': '\u0C05',
    'ee': '\u0C08',
    'ii': '\u0C08',
    'i': '\u0C07',
    'oo': '\u0C0A',
    'uu': '\u0C0A',
    'u': '\u0C09',
    'ai': '\u0C10',
    'au': '\u0C14',
    'ou': '\u0C14',
    'e': '\u0C0E',
    'o': '\u0C12'
  };

  static MATRAS = {
    'aa': '\u0C3E',
    'a': '\u0C3E',
    'ee': '\u0C40',
    'ii': '\u0C40',
    'i': '\u0C3F',
    'oo': '\u0C42',
    'uu': '\u0C42',
    'u': '\u0C41',
    'ai': '\u0C48',
    'au': '\u0C4C',
    'ou': '\u0C4C',
    'e': '\u0C47',
    'o': '\u0C4B'
  };

  static CONSONANTS = {
    'ksh': '\u0C15\u0C4D\u0C37',
    'sh': '\u0C36',
    'ssh': '\u0C37',
    'ch': '\u0C1A',
    'chh': '\u0C1B',
    'th': '\u0C24',
    'dh': '\u0C27',
    'kh': '\u0C16',
    'gh': '\u0C18',
    'jh': '\u0C1D',
    'ph': '\u0C2B',
    'bh': '\u0C2D',
    'ny': '\u0C1E',
    'ng': '\u0C19',
    'gn': '\u0C1C\u0C4D\u0C1E',
    'k': '\u0C15',
    'g': '\u0C17',
    'j': '\u0C1C',
    't': '\u0C1F',
    'd': '\u0C26',
    'n': '\u0C28',
    'p': '\u0C2A',
    'f': '\u0C2B',
    'b': '\u0C2C',
    'm': '\u0C2E',
    'y': '\u0C2F',
    'r': '\u0C30',
    'l': '\u0C32',
    'v': '\u0C35',
    'w': '\u0C35',
    's': '\u0C38',
    'h': '\u0C39'
  };

  static VIRAMA = '\u0C4D';
  static ANUSVARA = '\u0C02';

  hasScript(text) {
    return /[a-zA-Z]/.test(text || '');
  }

  transliterateWord(word) {
    if (!word) return '';

    // Check punctuation prefix/suffix
    const match = word.match(/^([^a-zA-Z]*)([a-zA-Z.]+)([^a-zA-Z]*)$/);
    if (!match) return word;

    const prefix = match[1];
    let core = match[2].toLowerCase();
    const suffix = match[3];

    // 1. Direct dictionary lookup for common Christian names & titles (e.g. Dr., Pastor, John)
    if (EnglishToTeluguTransliterator.DICTIONARY[core]) {
      return prefix + EnglishToTeluguTransliterator.DICTIONARY[core] + suffix;
    }
    // Also try without trailing dot
    if (core.endsWith('.') && EnglishToTeluguTransliterator.DICTIONARY[core.slice(0, -1)]) {
      return prefix + EnglishToTeluguTransliterator.DICTIONARY[core.slice(0, -1)] + suffix;
    }

    // 2. Check for Single-Letter Initials (e.g., 'P.' -> 'పి.', 'K.' -> 'కె.')
    const letterOnly = core.replace(/[^a-z]/g, '');
    if (letterOnly.length === 1 && EnglishToTeluguTransliterator.INITIALS[letterOnly]) {
      const hasDot = core.includes('.');
      return prefix + EnglishToTeluguTransliterator.INITIALS[letterOnly] + (hasDot ? '.' : '') + suffix;
    }

    // Clean any dot inside phonetic conversion
    core = core.replace(/\./g, '');

    let result = '';
    let i = 0;
    const len = core.length;

    while (i < len) {
      let c = null;
      let cLen = 0;

      if (i + 3 <= len && EnglishToTeluguTransliterator.CONSONANTS[core.slice(i, i + 3)]) {
        c = EnglishToTeluguTransliterator.CONSONANTS[core.slice(i, i + 3)];
        cLen = 3;
      } else if (i + 2 <= len && EnglishToTeluguTransliterator.CONSONANTS[core.slice(i, i + 2)]) {
        c = EnglishToTeluguTransliterator.CONSONANTS[core.slice(i, i + 2)];
        cLen = 2;
      } else if (EnglishToTeluguTransliterator.CONSONANTS[core[i]]) {
        c = EnglishToTeluguTransliterator.CONSONANTS[core[i]];
        cLen = 1;
      }

      if (c) {
        i += cLen;

        // Anusvara at end of word: e.g. 'anandam' -> 'ఆనందం', 'satyanandam' -> 'సత్యానందం'
        if (core.slice(i - cLen) === 'm' && i === len) {
          result += EnglishToTeluguTransliterator.ANUSVARA;
          break;
        }

        let v = null;
        let vLen = 0;

        if (i + 2 <= len && EnglishToTeluguTransliterator.MATRAS[core.slice(i, i + 2)]) {
          v = EnglishToTeluguTransliterator.MATRAS[core.slice(i, i + 2)];
          vLen = 2;
        } else if (i < len && EnglishToTeluguTransliterator.MATRAS[core[i]]) {
          if (core[i] === 'a') {
            v = (i + 1 === len) ? '\u0C3E' : '';
          } else {
            v = EnglishToTeluguTransliterator.MATRAS[core[i]];
          }
          vLen = 1;
        }

        if (v !== null) {
          result += c + v;
          i += vLen;
        } else {
          result += c + EnglishToTeluguTransliterator.VIRAMA;
        }
        continue;
      }

      // Independent Vowels
      let iv = null;
      let ivLen = 0;
      if (i + 2 <= len && EnglishToTeluguTransliterator.INDEPENDENT_VOWELS[core.slice(i, i + 2)]) {
        iv = EnglishToTeluguTransliterator.INDEPENDENT_VOWELS[core.slice(i, i + 2)];
        ivLen = 2;
      } else if (EnglishToTeluguTransliterator.INDEPENDENT_VOWELS[core[i]]) {
        iv = EnglishToTeluguTransliterator.INDEPENDENT_VOWELS[core[i]];
        ivLen = 1;
      }

      if (iv) {
        result += iv;
        i += ivLen;
        continue;
      }

      result += core[i];
      i++;
    }

    return prefix + result + suffix;
  }

  transliterate(text, options = {}) {
    if (!text) return '';
    const lines = text.split('\n');
    return lines.map(line => {
      const tokens = line.split(/(\s+|[.,/#!$%\^&*;:{}=\-_`~()]+)/);
      const converted = tokens.map(token => {
        if (/^[\s.,/#!$%\^&*;:{}=\-_`~()]+$/.test(token)) return token;
        return this.transliterateWord(token);
      }).join('');
      return converted
        .replace(/\.{2,}/g, '.')
        .replace(/\s+\./g, '.')
        .replace(/బ్రదర్\./g, 'బ్రదర్')
        .replace(/సిస్టర్\./g, 'సిస్టర్')
        .replace(/పాస్టర్\./g, 'పాస్టర్');
    }).join('\n');
  }
}

/**
 * Universal Service Facade for all form inputs & components
 */
export class TransliteratorService {
  static registry = {
    telugu: new TeluguTransliterator(),
    english_to_telugu: new EnglishToTeluguTransliterator()
  };

  /**
   * Register a custom transliterator for any language
   */
  static register(langKey, instance) {
    this.registry[langKey.toLowerCase()] = instance;
  }

  /**
   * Transliterate to English (from Telugu, etc.)
   */
  static transliterate(text, language = 'telugu', options = {}) {
    if (!text) return '';
    const lang = (language || 'telugu').toLowerCase();
    const engine = this.registry[lang] || this.registry.telugu;
    return engine.transliterate(text, options);
  }

  /**
   * Transliterate English text into Telugu script
   */
  static toTelugu(text, options = {}) {
    if (!text) return '';
    return this.registry.english_to_telugu.transliterate(text, options);
  }

  /**
   * Smart bidirectional transliteration based on script detection:
   * - If text has Telugu characters -> transliterates to English
   * - If text is Latin/English -> transliterates to Telugu!
   */
  static autoConvert(text, options = {}) {
    if (!text) return '';
    if (this.isTelugu(text)) {
      return this.transliterate(text, 'telugu', options);
    } else {
      return this.toTelugu(text, options);
    }
  }

  /**
   * Test if the text contains Telugu script
   */
  static isTelugu(text) {
    return /[\u0C00-\u0C7F]/.test(text || '');
  }
}

export default TransliteratorService;
