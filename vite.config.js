import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import TransliteratorService from './src/utils/transliterator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function slugify(text) {
  return (text || '')
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

function adminSongApiPlugin() {
  return {
    name: 'admin-song-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url ? req.url.split('?')[0] : '';

        // 1. Password Verification Endpoint
        if (req.method === 'POST' && url === '/api/admin/verify-password') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            try {
              const data = JSON.parse(body || '{}');
              const validPass = process.env.VITE_ADMIN_PASSWORD || 'sherwin1990';
              if (data.password === validPass) {
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: true, token: 'jhf-admin-valid' }));
              } else {
                res.statusCode = 401;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: false, error: 'Invalid admin password. Please try again.' }));
              }
            } catch (err) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: false, error: err.message }));
            }
          });
          return;
        }

        // 2. Publish Song Endpoint
        if (req.method === 'POST' && url === '/api/admin/publish-song') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            try {
              const songInput = JSON.parse(body || '{}');

              if (!songInput.title) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: false, error: 'Title is required' }));
                return;
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

              const authorEnglish = songInput.author_english || (songInput.author_telugu ? TransliteratorService.transliterate(songInput.author_telugu, lang) : '');
              const authorTelugu = songInput.author_telugu || (songInput.author_english ? TransliteratorService.toTelugu(songInput.author_english) : '');
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

              // Write files in public/data/songs/
              const songsDir = path.join(__dirname, 'public', 'data', 'songs');
              if (!fs.existsSync(songsDir)) {
                fs.mkdirSync(songsDir, { recursive: true });
              }

              const slugFilePath = path.join(songsDir, `${slug}.json`);
              const idFilePath = path.join(songsDir, `${id}.json`);
              const songJsonStr = JSON.stringify(fullSongData, null, 2);

              fs.writeFileSync(slugFilePath, songJsonStr, 'utf8');
              fs.writeFileSync(idFilePath, songJsonStr, 'utf8');

              // Update compact_index.json
              const indexFile = path.join(__dirname, 'public', 'data', 'compact_index.json');
              let indexData = [];
              if (fs.existsSync(indexFile)) {
                try {
                  indexData = JSON.parse(fs.readFileSync(indexFile, 'utf8'));
                } catch (e) {
                  console.error('Error reading compact_index:', e);
                }
              }

              const existingIdx = indexData.findIndex(s => s.id === id || s.slug === slug);
              if (existingIdx >= 0) {
                indexData[existingIdx] = compactIndexEntry;
              } else {
                // Prepend so the newly published song appears at the top!
                indexData.unshift(compactIndexEntry);
              }

              fs.writeFileSync(indexFile, JSON.stringify(indexData), 'utf8');

              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({
                success: true,
                message: 'Song published and saved successfully!',
                song: fullSongData,
                indexEntry: compactIndexEntry,
                totalCount: indexData.length
              }));
            } catch (err) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: false, error: err.message }));
            }
          });
          return;
        }

        next();
      });
    }
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), adminSongApiPlugin()],
  base: './',
  server: {
    port: 3000
  }
});
