/**
 * Automatic Church PowerPoint (.pptx) Generator
 * 
 * Dynamically builds 16:9 widescreen presentation slides for any song
 * with crystal clear typography for church projectors and TVs.
 */
import pptxgen from 'pptxgenjs';

/**
 * Format chunks of lines for presentation slides.
 * Each slide contains 2-4 lines of lyrics for maximum readability in back rows.
 */
function chunkLyrics(origLines = [], transLines = [], maxLinesPerSlide = 2) {
  const slides = [];
  let currentOrig = [];
  let currentTrans = [];
  let currentSection = '';

  const totalLines = Math.max(origLines.length, transLines.length);

  for (let i = 0; i < totalLines; i++) {
    const oLine = (origLines[i] || '').trim();
    const tLine = (transLines[i] || '').trim();

    // Check if line is empty (stanza separator)
    if (!oLine && !tLine) {
      if (currentOrig.length > 0) {
        slides.push({
          section: currentSection,
          original: [...currentOrig],
          transliterated: [...currentTrans]
        });
        currentOrig = [];
        currentTrans = [];
      }
      continue;
    }

    // Check for section tag at start of line (e.g. ప||, చ|| 1., Pa||, Cha|| 1.)
    const tagMatch = oLine.match(/^([పచఅ]\s*\|\|\s*(?:\d+|[౦-౯]+)?\.?|Pa\|\|\s*|Cha\|\|\s*\d*\.?|Anu\.Pa\|\|\s*|Pallavi:?|Charanam:?)/i);
    if (tagMatch) {
      currentSection = tagMatch[1].trim();
    }

    currentOrig.push(oLine);
    currentTrans.push(tLine);

    if (currentOrig.length >= maxLinesPerSlide) {
      slides.push({
        section: currentSection,
        original: [...currentOrig],
        transliterated: [...currentTrans]
      });
      currentOrig = [];
      currentTrans = [];
    }
  }

  if (currentOrig.length > 0) {
    slides.push({
      section: currentSection,
      original: [...currentOrig],
      transliterated: [...currentTrans]
    });
  }

  return slides;
}

/**
 * Generate and download a PowerPoint presentation (.pptx) for a song.
 *
 * @param {Object} song - The song data object.
 * @param {Object} [options] - Configuration options.
 * @returns {Promise<string>} - Resolves with the filename when downloaded.
 */
export async function generateSongPptx(song, options = {}) {
  if (!song) throw new Error('Song data is required to generate PowerPoint');

  const pptx = new pptxgen();
  pptx.layout = 'LAYOUT_16x9';

  // Presentation metadata
  pptx.title = song.title || 'Christian Lyrics';
  pptx.subject = song.title_transliterated || '';
  pptx.author = song.author_english || song.author_telugu || 'Jesus Heals Fellowship Church';
  pptx.company = 'Jesus Heals Fellowship Church';

  const isDualScript = options.dualScript !== false && song.lyrics_transliterated && song.lyrics_transliterated.length > 0;
  const maxLines = isDualScript ? 2 : 4;

  const slidesData = chunkLyrics(
    song.lyrics_original || [],
    song.lyrics_transliterated || [],
    maxLines
  );

  const totalSlides = slidesData.length + 2; // +1 title slide, +1 closing slide

  // -------------------------------------------------------------
  // SLIDE 1: Title & Info Slide
  // -------------------------------------------------------------
  const titleSlide = pptx.addSlide();
  titleSlide.background = { color: '0B1120' }; // Deep sanctuary obsidian navy

  // Amber top accent bar
  titleSlide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: '100%', h: 0.18, fill: { color: 'F59E0B' }
  });

  // Native Song Title
  titleSlide.addText(song.title || 'Song Title', {
    x: 0.8, y: 1.5, w: 11.73, h: 1.5,
    fontSize: 42, color: 'FFFFFF', bold: true, align: 'center', fontFace: 'Arial'
  });

  // English Transliterated Title (if available)
  if (song.title_transliterated) {
    titleSlide.addText(song.title_transliterated, {
      x: 0.8, y: 3.1, w: 11.73, h: 0.8,
      fontSize: 24, color: 'FBBF24', italic: true, align: 'center', fontFace: 'Calibri'
    });
  }

  // Metadata block (Author, Book, Categories)
  const metaParts = [];
  const author = [song.author_english, song.author_telugu].filter(Boolean).join(' / ');
  if (author) metaParts.push(`Author / Composer: ${author}`);

  if (song.songbooks && song.songbooks.length > 0) {
    const bookStr = song.songbooks.map(b => `${b.book.replace(/-/g, ' ')}${b.number ? ` #${b.number}` : ''}`).join(', ');
    metaParts.push(`Collection: ${bookStr}`);
  }

  if (song.category_names && song.category_names.length > 0) {
    metaParts.push(`Theme: ${song.category_names.join(', ')}`);
  }

  if (metaParts.length > 0) {
    titleSlide.addText(metaParts.join('\n'), {
      x: 0.8, y: 4.2, w: 11.73, h: 1.5,
      fontSize: 14, color: '94A3B8', align: 'center', fontFace: 'Calibri', lineSpacing: 22
    });
  }

  // Church watermark
  titleSlide.addText('Jesus Heals Fellowship Church', {
    x: 0.8, y: 6.6, w: 11.73, h: 0.4,
    fontSize: 12, color: '64748B', align: 'center', fontFace: 'Calibri'
  });

  // -------------------------------------------------------------
  // SLIDES 2...N: Lyrics Slides
  // -------------------------------------------------------------
  slidesData.forEach((slideItem, index) => {
    const slide = pptx.addSlide();
    slide.background = { color: '0B1120' };

    // Amber top accent bar
    slide.addShape(pptx.ShapeType.rect, {
      x: 0, y: 0, w: '100%', h: 0.1, fill: { color: 'F59E0B' }
    });

    // Small Slide Header (Song Title + Section Tag)
    const headerTitle = song.title || '';
    const headerSection = slideItem.section ? `  •  ${slideItem.section}` : '';
    slide.addText(`${headerTitle}${headerSection}`, {
      x: 0.8, y: 0.35, w: 9, h: 0.4,
      fontSize: 13, color: 'F59E0B', bold: true, fontFace: 'Calibri'
    });

    // Slide Counter in top right
    slide.addText(`${index + 2} / ${totalSlides}`, {
      x: 10.5, y: 0.35, w: 2, h: 0.4,
      fontSize: 12, color: '64748B', align: 'right', fontFace: 'Calibri'
    });

    // Build Formatted Lyric Text Array
    const textObjects = [];
    const count = Math.max(slideItem.original.length, slideItem.transliterated.length);

    for (let j = 0; j < count; j++) {
      const orig = slideItem.original[j] || '';
      const trans = isDualScript ? (slideItem.transliterated[j] || '') : '';

      if (orig) {
        textObjects.push({
          text: orig + '\n',
          options: {
            fontSize: isDualScript ? 32 : 36,
            color: 'FFFFFF',
            bold: true,
            fontFace: 'Arial'
          }
        });
      }

      if (trans && isDualScript) {
        textObjects.push({
          text: trans + (j < count - 1 ? '\n\n' : '\n'),
          options: {
            fontSize: 20,
            color: 'FCD34D',
            italic: true,
            fontFace: 'Calibri'
          }
        });
      } else if (orig && j < count - 1) {
        textObjects.push({
          text: '\n',
          options: { fontSize: 16 }
        });
      }
    }

    slide.addText(textObjects, {
      x: 0.8, y: 1.2, w: 11.73, h: 5.2,
      align: 'center', valign: 'middle', lineSpacing: isDualScript ? 36 : 48
    });

    // Subtle Footer
    slide.addText('Jesus Heals Fellowship Church', {
      x: 0.8, y: 6.8, w: 11.73, h: 0.35,
      fontSize: 11, color: '475569', align: 'center', fontFace: 'Calibri'
    });
  });

  // -------------------------------------------------------------
  // FINAL SLIDE: Benediction & Blessing
  // -------------------------------------------------------------
  const closingSlide = pptx.addSlide();
  closingSlide.background = { color: '0B1120' };

  closingSlide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: '100%', h: 0.18, fill: { color: 'F59E0B' }
  });

  closingSlide.addText('హల్లెలూయా! ఆమెన్\nHallelooyaa! Amen', {
    x: 0.8, y: 2.2, w: 11.73, h: 1.8,
    fontSize: 40, color: 'FFFFFF', bold: true, align: 'center', fontFace: 'Arial', lineSpacing: 48
  });

  closingSlide.addText('Jesus Heals Fellowship Church\nAll Christian Songs Portal', {
    x: 0.8, y: 4.4, w: 11.73, h: 1.2,
    fontSize: 16, color: 'FBBF24', align: 'center', fontFace: 'Calibri', lineSpacing: 24
  });

  // Clean filename: e.g. "Yesu-Naamam-Athi-Madhuram.pptx"
  const safeTitle = (song.title_transliterated || song.title || 'Worship-Song')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_-]+/g, '-');
  const fileName = `${safeTitle || 'Song'}-Lyrics.pptx`;

  // Trigger browser download
  await pptx.writeFile({ fileName });

  return fileName;
}

export default generateSongPptx;
