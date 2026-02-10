/**
 * Seed API Key for Local Testing
 *
 * Run this before batch experiments when using the local emulator.
 * This creates a test API key in Firestore that the batch script can use.
 */

import * as admin from 'firebase-admin';
import {scrypt, randomBytes, createHash} from 'crypto';
import {promisify} from 'util';

const scryptAsync = promisify(scrypt);

// Initialize Firebase Admin for emulator
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';

const app = admin.initializeApp({
  projectId: 'deliberate-lab',
});
const firestore = app.firestore();

// Known test API key - use this in your batch experiments
const TEST_API_KEY = 'dlb_test_localdevkey123456789';
const TEST_EXPERIMENTER_ID = 'test-experimenter-local';

async function hashApiKey(
  apiKey: string,
): Promise<{hash: string; salt: string}> {
  const salt = randomBytes(16).toString('hex');
  const hashBuffer = (await scryptAsync(apiKey, salt, 64)) as Buffer;
  return {
    hash: hashBuffer.toString('hex'),
    salt,
  };
}

function getKeyId(apiKey: string): string {
  const hash = createHash('sha256').update(apiKey).digest('hex');
  return hash.substring(0, 8);
}

async function seedApiKey() {
  console.log('🔑 Seeding test API key to Firestore emulator...\n');

  const keyId = getKeyId(TEST_API_KEY);
  const {hash, salt} = await hashApiKey(TEST_API_KEY);

  // Get Gemini API key from command line or environment
  const geminiApiKey = process.argv[2] || process.env.GEMINI_API_KEY || '';
  if (!geminiApiKey) {
    console.log(
      '⚠️  No Gemini API key provided. Agents will not be able to make LLM calls.',
    );
    console.log(
      '   Usage: npx tsx scripts/seed_api_key.ts YOUR_GEMINI_API_KEY\n',
    );
  }

  // Create experimenter document with Gemini API key
  await firestore
    .collection('experimenters')
    .doc(TEST_EXPERIMENTER_ID)
    .set(
      {
        id: TEST_EXPERIMENTER_ID,
        email: 'test@example.com',
        createdAt: Date.now(),
        apiKeys: {
          geminiApiKey: geminiApiKey,
          openaiApiKey: '',
          anthropicApiKey: '',
        },
      },
      {merge: true},
    );

  // Create API key
  await firestore
    .collection('experimenters')
    .doc(TEST_EXPERIMENTER_ID)
    .collection('apiKeys')
    .doc(keyId)
    .set({
      keyId,
      hash,
      salt,
      experimenterId: TEST_EXPERIMENTER_ID,
      name: 'Local Test Key',
      permissions: ['read', 'write'],
      createdAt: Date.now(),
      lastUsed: null,
    });

  console.log('✅ API key seeded successfully!\n');
  console.log('Use this API key in your batch experiments:');
  console.log(`  --api-key ${TEST_API_KEY}\n`);
  console.log(`Key ID: ${keyId}`);
  console.log(`Experimenter ID: ${TEST_EXPERIMENTER_ID}`);

  process.exit(0);
}

seedApiKey().catch((err) => {
  console.error('❌ Error seeding API key:', err);
  process.exit(1);
});
