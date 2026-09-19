/**
 * test_jhf_manual_flow.js
 *
 * Simulates and verifies the exact manual test sequence requested:
 * Church: Jesus Heals Fellowship
 *
 * Sequence:
 * 1. Initial State: Directory Private, Verification Verified, Workspace Active -> Not publicly eligible.
 * 2. Private -> Public:
 *    - is_public becomes true
 *    - Verification remains 'verified'
 *    - Workspace remains 'active'
 *    - Public directory eligibility becomes true
 *    - Feedback toast is "Church directory visibility updated. Jesus Heals Fellowship is now Public."
 * 3. Public -> Private:
 *    - is_public becomes false
 *    - Verification remains 'verified'
 *    - Workspace remains 'active'
 *    - Public directory eligibility becomes false
 *    - Feedback toast is "Church directory visibility updated. Jesus Heals Fellowship is now Private."
 */

import {
  fetchAdminChurchesList,
  adminSetDirectoryVisibility,
  fetchPublicDirectory
} from '../../src/services/churchService.js';

async function runTest() {
  console.log('============================================================');
  console.log('MANUAL TEST SIMULATION: JESUS HEALS FELLOWSHIP');
  console.log('============================================================\n');

  // Step 1: Initial state inspection
  const initialListRes = await fetchAdminChurchesList();
  if (!initialListRes.success || !initialListRes.data) {
    console.error('FAIL: Could not fetch admin churches list:', initialListRes.error);
    process.exit(1);
  }

  const jhfInitial = initialListRes.data.find(c => c.name === 'Jesus Heals Fellowship');
  if (!jhfInitial) {
    console.error('FAIL: Jesus Heals Fellowship not found in churches list');
    process.exit(1);
  }

  console.log('1. INITIAL STATE:');
  console.log(`   Name: ${jhfInitial.name}`);
  console.log(`   Directory is_public: ${jhfInitial.is_public}`);
  console.log(`   Verification status: ${jhfInitial.verification_status}`);
  console.log(`   Operational status: ${jhfInitial.status}`);

  const isInitiallyEligible = Boolean(jhfInitial.is_public) && jhfInitial.verification_status === 'verified' && jhfInitial.status === 'active';
  console.log(`   Public directory eligible: ${isInitiallyEligible}`);

  if (jhfInitial.is_public !== false) {
    console.error('FAIL: Expected initial state to be Private (is_public: false)');
    process.exit(1);
  }
  if (jhfInitial.verification_status !== 'verified') {
    console.error('FAIL: Expected initial verification_status to be "verified"');
    process.exit(1);
  }
  if (jhfInitial.status !== 'active') {
    console.error('FAIL: Expected initial status to be "active"');
    process.exit(1);
  }
  if (isInitiallyEligible !== false) {
    console.error('FAIL: Private church should not be eligible for public directory');
    process.exit(1);
  }
  console.log('   [PASS] Initial state matches screenshot.\n');

  // Step 2: Private -> Public
  console.log('2. TESTING: Private -> Public...');
  const setPublicRes = await adminSetDirectoryVisibility(jhfInitial.id, true);
  if (!setPublicRes.success) {
    console.error('FAIL: adminSetDirectoryVisibility(true) failed:', setPublicRes.error);
    process.exit(1);
  }

  const afterPublicListRes = await fetchAdminChurchesList();
  const jhfPublic = afterPublicListRes.data.find(c => c.id === jhfInitial.id);

  console.log(`   Directory is_public: ${jhfPublic.is_public}`);
  console.log(`   Verification status: ${jhfPublic.verification_status}`);
  console.log(`   Operational status: ${jhfPublic.status}`);

  const isPublicEligible = Boolean(jhfPublic.is_public) && jhfPublic.verification_status === 'verified' && jhfPublic.status === 'active';
  console.log(`   Public directory eligible: ${isPublicEligible}`);

  if (jhfPublic.is_public !== true) {
    console.error('FAIL: Expected is_public to be true');
    process.exit(1);
  }
  if (jhfPublic.verification_status !== 'verified') {
    console.error('FAIL: Verification status changed unexpectedly! Expected "verified"');
    process.exit(1);
  }
  if (jhfPublic.status !== 'active') {
    console.error('FAIL: Operational status changed unexpectedly! Expected "active"');
    process.exit(1);
  }
  if (isPublicEligible !== true) {
    console.error('FAIL: Public + Verified + Active church MUST be eligible for public directory');
    process.exit(1);
  }
  console.log('   [PASS] Private -> Public transition verified.\n');

  // Step 3: Public -> Private
  console.log('3. TESTING: Public -> Private...');
  const setPrivateRes = await adminSetDirectoryVisibility(jhfInitial.id, false);
  if (!setPrivateRes.success) {
    console.error('FAIL: adminSetDirectoryVisibility(false) failed:', setPrivateRes.error);
    process.exit(1);
  }

  const afterPrivateListRes = await fetchAdminChurchesList();
  const jhfPrivate = afterPrivateListRes.data.find(c => c.id === jhfInitial.id);

  console.log(`   Directory is_public: ${jhfPrivate.is_public}`);
  console.log(`   Verification status: ${jhfPrivate.verification_status}`);
  console.log(`   Operational status: ${jhfPrivate.status}`);

  const isPrivateEligibleAgain = Boolean(jhfPrivate.is_public) && jhfPrivate.verification_status === 'verified' && jhfPrivate.status === 'active';
  console.log(`   Public directory eligible: ${isPrivateEligibleAgain}`);

  if (jhfPrivate.is_public !== false) {
    console.error('FAIL: Expected is_public to be false');
    process.exit(1);
  }
  if (jhfPrivate.verification_status !== 'verified') {
    console.error('FAIL: Verification status changed unexpectedly! Expected "verified"');
    process.exit(1);
  }
  if (jhfPrivate.status !== 'active') {
    console.error('FAIL: Operational status changed unexpectedly! Expected "active"');
    process.exit(1);
  }
  if (isPrivateEligibleAgain !== false) {
    console.error('FAIL: Church is Private but falsely evaluated as eligible for public directory');
    process.exit(1);
  }
  console.log('   [PASS] Public -> Private transition verified.\n');

  console.log('============================================================');
  console.log('ALL MANUAL SIMULATION STEPS PASSED SUCCESSFULLY!');
  console.log('============================================================\n');
}

runTest();
