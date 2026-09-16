#!/usr/bin/env node

/**
 * Script to add a new song to ChristianLyricsWeb.
 *
 * Usage:
 *   node scripts/add-song.js <path-to-song-json>
 *
 * Example:
 *   node scripts/add-song.js scripts/song-template.json
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import TransliteratorService from '../src/utils/transliterator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const SONGS_DIR = path.join(rootDir, 'public', 'data', 'songs');
const INDEX_FILE = path.join(rootDir, 'public', 'data', 'compact_index.json');

function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function getFirstAlphabet(title, lang) {
  const clean = (title || '').trim().replace(/^["'‘“]/, '');
  if (!clean) return 'A';
  if (lang === 'telugu' || clean.charCodeAt(0) > 127) {
    return clean.charAt(0);
  }
  return clean.charAt(0).toUpperCase();
}

async function main() {
  const args = process.argv.slice(2);
  const inputFilePath = args[0];

  if (!inputFilePath) {
    console.log(`
\x1b[36mChristian Lyrics Web - Add Song Utility\x1b[0m

\x1b[33mUsage:\x1b[0m
  node scripts/add-song.js <path-to-your-song-data.json>

\x1b[32mExample:\x1b[0m
  node scripts/add-song.js scripts/song-template.json

\x1b[90mA template file is available at: scripts/song-template.json\x1b[0m
`);
    process.exit(0);
  }

  const resolvedInputPath = path.resolve(process.cwd(), inputFilePath);
  if (!fs.existsSync(resolvedInputPath)) {
    console.error(`\x1b[31mError: File not found at ${resolvedInputPath}\x1b[0m`);
    process.exit(1);
  }

  let songInput;
  try {
    songInput = JSON.parse(fs.readFileSync(resolvedInputPath, 'utf8'));
  } catch (err) {
    console.error(`\x1b[31mError parsing JSON in ${resolvedInputPath}: ${err.message}\x1b[0m`);
    process.exit(1);
  }

  if (!songInput.title) {
    console.error('\x1b[31mError: "title" is required in the song JSON.\x1b[0m');
    process.exit(1);
  }

  const id = songInput.id || crypto.randomUUID();
  const lang = (songInput.language || 'telugu').toLowerCase();
  const titleTransliterated = songInput.title_transliterated || TransliteratorService.transliterate(songInput.title, lang);
  const slugBase = songInput.slug || titleTransliterated || songInput.title;
  const slug = slugify(slugBase) || id;

  let lyricsTransliterated = songInput.lyrics_transliterated || [];
  if ((!lyricsTransliterated || lyricsTransliterated.length === 0) && songInput.lyrics_original && songInput.lyrics_original.length > 0) {
    lyricsTransliterated = TransliteratorService.transliterate(songInput.lyrics_original.join('\n'), lang).split('\n');
  }

  const alpha = songInput.alphabet || getFirstAlphabet(songInput.title, lang);
  const hasChords = !!(songInput.chords && songInput.chords.length > 0);
  const hasVideo = !!songInput.youtube_id;
  const hasPpt = !!songInput.ppt_url;

  const authorEnglish = songInput.author_english || '';
  const authorTelugu = songInput.author_telugu || '';
  const author = authorEnglish || authorTelugu;

  const searchParts = [
    songInput.title,
    titleTransliterated,
    authorEnglish,
    authorTelugu,
    ...(songInput.category_names || [])
  ].filter(Boolean).join(' ').toLowerCase();

  const fullSongData = {
    id,
    slug,
    title: songInput.title,
    title_transliterated: titleTransliterated || '',
    language: lang,
    alphabet: alpha,
    lyrics_original: songInput.lyrics_original || [],
    lyrics_transliterated: lyricsTransliterated,
    youtube_id: songInput.youtube_id || null,
    chords: hasChords ? songInput.chords : null,
    chord_count: hasChords ? (songInput.chord_count || songInput.chords.length) : 0,
    chord_credits: songInput.chord_credits || null,
    author_english: authorEnglish || null,
    author_telugu: authorTelugu || null,
    category_names: songInput.category_names || ['Worship Songs'],
    songbooks: songInput.songbooks || [],
    ppt_url: songInput.ppt_url || null,
    bible_verses: songInput.bible_verses || [],
    devotional: songInput.devotional || null
  };

  const compactIndexEntry = {
    id,
    slug,
    t: songInput.title,
    tr: songInput.title_transliterated || '',
    lang,
    alpha,
    chords: hasChords,
    video: hasVideo,
    yt: songInput.youtube_id || '',
    ppt: hasPpt,
    cats: songInput.category_names || ['Worship Songs'],
    books: songInput.songbooks || [],
    auth: author,
    search: searchParts
  };

  // 1. Write song files in public/data/songs/
  if (!fs.existsSync(SONGS_DIR)) {
    fs.mkdirSync(SONGS_DIR, { recursive: true });
  }

  const slugFilePath = path.join(SONGS_DIR, `${slug}.json`);
  const idFilePath = path.join(SONGS_DIR, `${id}.json`);
  const songJsonStr = JSON.stringify(fullSongData, null, 2);

  fs.writeFileSync(slugFilePath, songJsonStr, 'utf8');
  fs.writeFileSync(idFilePath, songJsonStr, 'utf8');

  // 2. Update compact_index.json
  let indexData = [];
  if (fs.existsSync(INDEX_FILE)) {
    try {
      indexData = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'));
    } catch (err) {
      console.error(`\x1b[31mError reading ${INDEX_FILE}: ${err.message}\x1b[0m`);
      process.exit(1);
    }
  }

  const existingIdx = indexData.findIndex(s => s.id === id || s.slug === slug);
  if (existingIdx >= 0) {
    indexData[existingIdx] = compactIndexEntry;
    console.log(`\x1b[33mUpdated existing song in index at position ${existingIdx}\x1b[0m`);
  } else {
    // Insert at beginning or end
    indexData.push(compactIndexEntry);
    console.log(`\x1b[32mAppended new song to search index. Total catalog count: ${indexData.length}\x1b[0m`);
  }

  fs.writeFileSync(INDEX_FILE, JSON.stringify(indexData), 'utf8');

  console.log(`
\x1b[32m✔ Song added successfully!\x1b[0m
  • \x1b[1mTitle:\x1b[0m ${fullSongData.title} (${fullSongData.title_transliterated || 'No transliteration'})
  • \x1b[1mID:\x1b[0m ${id}
  • \x1b[1mSlug:\x1b[0m ${slug}
  • \x1b[1mFiles created:\x1b[0m
    - ${slugFilePath}
    - ${idFilePath}
  • \x1b[1mSearch Index:\x1b[0m Updated (${INDEX_FILE})
`);
}

main().catch(err => {
  console.error('\x1b[31mUnexpected error:\x1b[0m', err);
  process.exit(1);
});
