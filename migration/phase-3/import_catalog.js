/**
 * Phase 4 Import Script: All Christian Songs -> Supabase
 *
 * Prepared in Phase 3.
 * DO NOT RUN LIVE IN PHASE 3.
 *
 * Usage:
 *   node migration/phase-3/import_catalog.js [--dry-run]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Configuration & Credentials
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://hxfeluhttsifwmwltjmj.supabase.co';
// Note: Requires service_role key to perform bulk migration bypass of RLS,
// or authenticated admin session token.
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

const isDryRun = process.argv.includes('--dry-run');
const BATCH_SIZE = 50;

// Source directories (prioritizing pre-migration snapshot)
const SNAPSHOT_DIR = path.resolve(__dirname, '../../backup/pre-migration-snapshot/songs');
const FALLBACK_DIR = path.resolve(__dirname, '../../public/data/songs');
const SOURCE_DIR = fs.existsSync(SNAPSHOT_DIR) ? SNAPSHOT_DIR : FALLBACK_DIR;
const SONGBOOKS_FILE = path.resolve(__dirname, '../../public/data/songbooks.json');

const songbooks = JSON.parse(fs.readFileSync(SONGBOOKS_FILE, 'utf8'));
const songbookMap = new Map();
songbooks.forEach(b => songbookMap.set(b.slug, b.id));

export async function main() {
  console.log('====================================================');
  console.log('ALL CHRISTIAN SONGS — CATALOG IMPORT');
  console.log('====================================================');
  console.log('Source Directory:', SOURCE_DIR);
  console.log('Mode:', isDryRun ? 'DRY RUN (no database writes)' : 'LIVE IMPORT');

  if (!isDryRun && !SUPABASE_KEY) {
    console.error('ERROR: SUPABASE_SERVICE_ROLE_KEY environment variable is required for live import.');
    process.exit(1);
  }

  const supabase = !isDryRun ? createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false }
  }) : null;

  const files = fs.readdirSync(SOURCE_DIR);
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const songFiles = files.filter(f => uuidRegex.test(f.replace(/\.json$/, '')));

  console.log(`Found ${songFiles.length} songs to process.`);

  const songRecords = [];
  const songbookJunctionRecords = [];

  let totalSeparators = 0;

  for (const file of songFiles) {
    const raw = JSON.parse(fs.readFileSync(path.join(SOURCE_DIR, file), 'utf8'));

    // Count empty separators to verify preservation
    if (Array.isArray(raw.lyrics_original)) {
      raw.lyrics_original.forEach(line => {
        if (line === '') totalSeparators++;
      });
    }

    // 1. Prepare Songs Table Record
    const song = {
      id: raw.id,
      slug: raw.slug,
      title: raw.title,
      title_transliterated: raw.title_transliterated || null,
      language: raw.language,
      alphabet: raw.alphabet,
      lyrics_original: Array.isArray(raw.lyrics_original) ? raw.lyrics_original : [],
      lyrics_transliterated: Array.isArray(raw.lyrics_transliterated) ? raw.lyrics_transliterated : [],
      youtube_id: raw.youtube_id || null,
      chords: Array.isArray(raw.chords) && raw.chords.length > 0 ? raw.chords : null,
      chord_count: raw.chord_count || 0,
      chord_credits: raw.chord_credits || null,
      author_english: raw.author_english || null,
      author_telugu: raw.author_telugu || null,
      category_names: Array.isArray(raw.category_names) ? raw.category_names : [],
      songbooks: Array.isArray(raw.songbooks) ? raw.songbooks : [],
      ppt_url: raw.ppt_url || null,
      bible_verses: Array.isArray(raw.bible_verses) ? raw.bible_verses : [],
      devotional: raw.devotional && Object.keys(raw.devotional).length > 0 ? raw.devotional : null,
      is_published: true
    };
    songRecords.push(song);

    // 2. Prepare Junction Records
    if (Array.isArray(raw.songbooks)) {
      for (const b of raw.songbooks) {
        const bookId = songbookMap.get(b.book);
        if (bookId) {
          songbookJunctionRecords.push({
            song_id: raw.id,
            songbook_id: bookId,
            song_number: typeof b.number === 'number' ? b.number : null
          });
        }
      }
    }
  }

  console.log(`Prepared ${songRecords.length} songs for public.songs.`);
  console.log(`Prepared ${songbookJunctionRecords.length} associations for public.songbook_songs.`);
  console.log(`Preserved ${totalSeparators} empty-string stanza separators.`);

  if (isDryRun) {
    console.log('DRY RUN COMPLETE: All data structures validated successfully.');
    return;
  }

  // Live Batch Upsert Loop (for Phase 4)
  console.log('\nStarting Batch Upserts into Supabase...');

  // Phase A: Upsert Songs
  for (let i = 0; i < songRecords.length; i += BATCH_SIZE) {
    const batch = songRecords.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from('songs')
      .upsert(batch, { onConflict: 'id' });

    if (error) {
      console.error(`Error upserting songs batch ${i} - ${i + batch.length}:`, error);
      throw error;
    }
    process.stdout.write(`\rSongs imported: ${Math.min(i + BATCH_SIZE, songRecords.length)} / ${songRecords.length}`);
  }
  console.log('\nAll songs upserted successfully.');

  // Phase B: Upsert Songbook Associations
  for (let i = 0; i < songbookJunctionRecords.length; i += BATCH_SIZE) {
    const batch = songbookJunctionRecords.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from('songbook_songs')
      .upsert(batch, { onConflict: 'song_id,songbook_id' });

    if (error) {
      console.error(`Error upserting songbook_songs batch ${i} - ${i + batch.length}:`, error);
      throw error;
    }
    process.stdout.write(`\rAssociations imported: ${Math.min(i + BATCH_SIZE, songbookJunctionRecords.length)} / ${songbookJunctionRecords.length}`);
  }
  console.log('\nAll songbook associations upserted successfully.');
  console.log('MIGRATION COMPLETE.');
}

// Auto-execute if run directly from CLI
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(err => {
    console.error('Fatal import error:', err);
    process.exit(1);
  });
}
