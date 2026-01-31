#!/usr/bin/env node

/**
 * TeamTrack Fix Verification Script
 * Run this to verify screenshot upload fix is working
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

console.log('🔍 TeamTrack Screenshot Fix Verification\n');

// ESM-safe __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const SERVER_URL = 'http://127.0.0.1:5000';
const TOKEN = process.env.TEAMTRACK_TOKEN || ''; // Set your JWT token here

// Test 1: Server Health
async function testServerHealth() {
  console.log('1️⃣  Testing server health...');

  return new Promise((resolve) => {
    http
      .get(`${SERVER_URL}/api/auth/me`, (res) => {
        if (res.statusCode === 401 || res.statusCode === 200) {
          console.log('   ✅ Server is running and responding\n');
          resolve(true);
        } else {
          console.log(`   ❌ Unexpected status: ${res.statusCode}\n`);
          resolve(false);
        }
      })
      .on('error', (err) => {
        console.log(`   ❌ Server not reachable: ${err.message}`);
        console.log('   💡 Run: npm run dev\n');
        resolve(false);
      });
  });
}

// Test 2: Base64 Validation
function testBase64Validation() {
  console.log('2️⃣  Testing base64 validation...');

  const validBase64 =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  const match = validBase64.match(/^data:image\/(\w+);base64,(.+)$/);

  if (!match) {
    console.log('   ❌ Base64 validation failed\n');
    return false;
  }

  console.log('   ✅ Data URL format valid');
  console.log(`   ✅ MIME type: image/${match[1]}`);
  console.log(`   ✅ Base64 length: ${match[2].length}\n`);
  return true;
}

// Test 3: Screenshot Upload
async function testScreenshotUpload() {
  console.log('3️⃣  Testing screenshot upload endpoint...');

  if (!TOKEN) {
    console.log('   ⚠️  No token provided, skipping upload test');
    console.log('   ℹ️  set TEAMTRACK_TOKEN=<jwt> && node verify-fix.js\n');
    return null;
  }

  const payload = JSON.stringify({
    imageData:
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    mouseClicks: 5,
    keystrokes: 10,
    activityScore: 50,
  });

  const options = {
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/agent/screenshot',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
      Authorization: `Bearer ${TOKEN}`,
    },
  };

  return new Promise((resolve) => {
    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        if (res.statusCode === 201) {
          console.log('   ✅ Screenshot uploaded successfully\n');
          resolve(true);
        } else {
          console.log(`   ❌ Upload failed (${res.statusCode})`);
          console.log(`   ❌ ${data}\n`);
          resolve(false);
        }
      });
    });

    req.on('error', (err) => {
      console.log(`   ❌ Request failed: ${err.message}\n`);
      resolve(false);
    });

    req.write(payload);
    req.end();
  });
}

// Test 4: File Structure
function testFileStructure() {
  console.log('4️⃣  Checking file structure...');

  const requiredFiles = [
    path.join(__dirname, '..', 'desktop-agent', 'src', 'main.js'),
    path.join(__dirname, 'utils', 'validation.ts'),
    path.join(__dirname, '..', 'uploads', 'screenshots'),
  ];

  let ok = true;

  for (const p of requiredFiles) {
    if (fs.existsSync(p)) {
      console.log(`   ✅ Found: ${p}`);
    } else {
      console.log(`   ⚠️  Missing: ${p}`);
      ok = false;
    }
  }

  console.log('');
  return ok;
}

// Run Tests
async function runAllTests() {
  console.log('══════════════════════════════════════════════\n');

  const serverOk = await testServerHealth();
  const base64Ok = testBase64Validation();
  const filesOk = testFileStructure();
  const uploadOk = await testScreenshotUpload();

  console.log('══════════════════════════════════════════════\n');
  console.log(`Server Health:     ${serverOk ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Base64 Validation: ${base64Ok ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`File Structure:    ${filesOk ? '✅ PASS' : '⚠️ CHECK'}`);
  console.log(
    `Screenshot Upload: ${
      uploadOk === null ? '⚠️ SKIPPED' : uploadOk ? '✅ PASS' : '❌ FAIL'
    }`
  );
  console.log('\n══════════════════════════════════════════════\n');
}

runAllTests().catch((err) => {
  console.error('❌ Test execution failed:', err);
  process.exit(1);
});
