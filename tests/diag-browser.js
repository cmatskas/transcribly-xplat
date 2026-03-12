/**
 * Diagnostic script for AgentCore Browser via Playwright CDP with SigV4 auth.
 */
const BrowserManager = require('../src/main/models/browserManager');

const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';

async function run() {
  console.log(`\n=== AgentCore Browser Diagnostics (Playwright + SigV4) ===`);
  console.log(`Region: ${region}\n`);

  const browser = new BrowserManager({ region });

  console.log('1. Starting session + SigV4 CDP connect...');
  try {
    const sessionId = await browser.startSession(300);
    console.log(`   ✅ Session: ${sessionId}`);
    console.log(`   ✅ Playwright connected via signed WebSocket\n`);
  } catch (err) {
    console.log(`   ❌ FAILED: ${err.message}\n`);
    return;
  }

  console.log('2. Navigating to https://example.com...');
  try {
    const nav = await browser.navigate('https://example.com');
    console.log(`   ✅ Title: ${nav.title}\n`);
  } catch (err) {
    console.log(`   ❌ FAILED: ${err.message}\n`);
  }

  console.log('3. Extracting page content...');
  try {
    const content = await browser.getPageContent();
    console.log(`   ✅ Content (${content.length} chars): ${content.substring(0, 200)}...\n`);
  } catch (err) {
    console.log(`   ❌ FAILED: ${err.message}\n`);
  }

  console.log('4. Stopping session...');
  try {
    await browser.stopSession();
    console.log('   ✅ Session stopped\n');
  } catch (err) {
    console.log(`   ❌ FAILED: ${err.message}\n`);
  }

  console.log('=== Diagnostics complete ===\n');
}

run().catch(err => console.error('Fatal:', err));
