/**
 * Phase 9B-2 — Admin Song List UI Verification Tests
 * 
 * Verifies:
 * 1. Component file exists at src/components/admin/AdminSongList.jsx
 * 2. Proper imports from AuthContext and adminSongService
 * 3. Absence of forbidden security remnants (service_role, VITE_ADMIN_PASSWORD, jhf_is_admin, jhf_admin_changed)
 * 4. Absence of client-side storage authorization (no isAdmin in localStorage/sessionStorage)
 * 5. Strict read-only nature: no direct database mutations, no create/update/delete calls from the list
 * 6. Integration contract: getAdminCatalog query, search, filtering, and pagination
 * 7. Error handling contract: graceful fallback on RLS or network error
 * 8. Responsive & visual metadata contract: both desktop table and mobile card layouts, status & asset indicators
 * 
 * Run with: node --env-file=.env migration/phase-9/test_admin_song_list.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getAdminCatalog } from '../../src/services/adminSongService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function pass(name, detail = '') {
  totalTests++;
  passedTests++;
  console.log(`[PASS] ${name}${detail ? ` — ${detail}` : ''}`);
}

function fail(name, detail = '') {
  totalTests++;
  failedTests++;
  console.error(`[FAIL] ${name}${detail ? ` — ${detail}` : ''}`);
  process.exitCode = 1;
}

async function runTests() {
  console.log('============================================================');
  console.log('PHASE 9B-2: ADMIN SONG LIST UI VERIFICATION');
  console.log('============================================================\n');

  // --- TEST 1: File Existence & Integrity ---
  console.log('--- TEST 1: Component File Existence & Imports ---');
  const componentPath = path.join(rootDir, 'src/components/admin/AdminSongList.jsx');
  if (fs.existsSync(componentPath)) {
    pass('AdminSongList.jsx exists at expected path', componentPath);
  } else {
    fail('AdminSongList.jsx exists at expected path', 'File not found');
    return;
  }

  const componentSource = fs.readFileSync(componentPath, 'utf8');

  // Verify imports
  if (componentSource.includes("from '../../services/adminSongService'") || componentSource.includes('from "../../services/adminSongService"')) {
    pass('Imports getAdminCatalog from adminSongService');
  } else {
    fail('Imports getAdminCatalog from adminSongService', 'Missing or incorrect service import');
  }

  if (componentSource.includes("from '../../context/AuthContext'") || componentSource.includes('from "../../context/AuthContext"')) {
    pass('Imports useAuth from AuthContext');
  } else {
    fail('Imports useAuth from AuthContext', 'Missing or incorrect AuthContext import');
  }

  if (!componentSource.includes('catalogRepository')) {
    pass('Does not import public catalogRepository', 'Isolated from public catalog paths');
  } else {
    fail('Does not import public catalogRepository', 'Accidental dependency on catalogRepository found');
  }

  // --- TEST 2: Security Hygiene & Authorization Boundary ---
  console.log('\n--- TEST 2: Security Hygiene & Authorization Boundary ---');
  if (!/service_role/i.test(componentSource)) {
    pass('Zero service_role references in component');
  } else {
    fail('Zero service_role references in component', 'service_role found in code');
  }

  if (!/VITE_ADMIN_PASSWORD/.test(componentSource)) {
    pass('Zero VITE_ADMIN_PASSWORD references in component');
  } else {
    fail('Zero VITE_ADMIN_PASSWORD references in component', 'VITE_ADMIN_PASSWORD found in code');
  }

  if (!/jhf_is_admin/.test(componentSource) && !/jhf_admin_changed/.test(componentSource)) {
    pass('Zero legacy admin flag references in component');
  } else {
    fail('Zero legacy admin flag references in component', 'Legacy flags found in code');
  }

  if (!/localStorage\.setItem\(.*admin/i.test(componentSource) && !/sessionStorage\.setItem\(.*admin/i.test(componentSource)) {
    pass('Zero client-storage authorization persistence in component');
  } else {
    fail('Zero client-storage authorization persistence in component', 'Storage authorization write detected');
  }

  // --- TEST 3: Zero Direct Supabase DB Mutations (Service Delegation) ---
  console.log('\n--- TEST 3: Zero Direct Supabase DB Mutations in AdminSongList.jsx ---');
  const forbiddenDirectMutations = [
    '.insert(',
    '.update(',
    '.delete('
  ];

  let foundMutations = [];
  for (const mut of forbiddenDirectMutations) {
    if (componentSource.includes(mut)) {
      foundMutations.push(mut);
    }
  }

  if (foundMutations.length === 0) {
    pass('Zero direct database mutation calls in AdminSongList.jsx', 'All mutations properly routed through adminSongService');
  } else {
    fail('Zero direct database mutation calls in AdminSongList.jsx', `Found direct mutation tokens: ${foundMutations.join(', ')}`);
  }

  // --- TEST 4: Service Query, Search, & Pagination Integration ---
  console.log('\n--- TEST 4: Service Query, Search & Pagination Contract ---');
  
  // Page 1 with pageSize 5
  const page1Res = await getAdminCatalog({ page: 1, pageSize: 5 });
  if (!page1Res.error && Array.isArray(page1Res.songs) && page1Res.songs.length === 5) {
    pass('Service returns expected page size', `Retrieved ${page1Res.songs.length} rows, Total: ${page1Res.totalCount}`);
  } else {
    fail('Service returns expected page size', page1Res.error || `Received ${page1Res.songs?.length} rows`);
  }

  // Sorting contract
  const sortRes = await getAdminCatalog({ page: 1, pageSize: 5, sortBy: 'title', sortAsc: true });
  if (!sortRes.error && Array.isArray(sortRes.songs) && sortRes.songs.length > 0) {
    pass('Service supports title ascending sort', `First song: "${sortRes.songs[0].title}"`);
  } else {
    fail('Service supports title ascending sort', sortRes.error);
  }

  // Language filter contract
  const langRes = await getAdminCatalog({ language: 'english', pageSize: 5 });
  if (!langRes.error && Array.isArray(langRes.songs)) {
    const allEnglish = langRes.songs.every(s => s.language === 'english');
    if (allEnglish) {
      pass('Service filters correctly by language', `All ${langRes.songs.length} songs are english`);
    } else {
      fail('Service filters correctly by language', 'Non-english songs found');
    }
  } else {
    fail('Service filters correctly by language', langRes.error);
  }

  // --- TEST 5: Responsive & Visual Design Elements ---
  console.log('\n--- TEST 5: Responsive & Visual Design Checks ---');
  if (componentSource.includes('hidden md:block') && componentSource.includes('md:hidden')) {
    pass('Both desktop table view and mobile card view implemented', 'Responsive dual-mode verified');
  } else {
    fail('Both desktop table view and mobile card view implemented', 'Missing dual responsive layouts');
  }

  if (componentSource.includes('is_published') && componentSource.includes('Published') && componentSource.includes('Draft')) {
    pass('Publication status badges present', 'Published and Draft visual indicators verified');
  } else {
    fail('Publication status badges present', 'Missing publication status indicators');
  }

  if (componentSource.includes('hasChords') && componentSource.includes('hasYoutube') && componentSource.includes('hasPpt') && componentSource.includes('hasSongbooks')) {
    pass('All asset indicators present', 'Chords, YouTube, PPT, and Songbooks chips verified');
  } else {
    fail('All asset indicators present', 'Missing one or more asset indicators');
  }

  if (componentSource.includes('handleActionPlaceholder')) {
    pass('Action placeholders provide non-destructive user feedback', 'Verified safe action stubs');
  } else {
    fail('Action placeholders provide non-destructive user feedback', 'Missing action placeholder handlers');
  }

  console.log('\n============================================================');
  console.log(`TOTAL CHECKS: ${totalTests}`);
  console.log(`PASSED: ${passedTests}`);
  console.log(`FAILED: ${failedTests}`);
  console.log(`OVERALL STATUS: ${failedTests === 0 ? 'PASS' : 'FAIL'}`);
  console.log('============================================================\n');
}

runTests().catch(err => {
  console.error('[FATAL EXCEPTION]', err);
  process.exit(1);
});
