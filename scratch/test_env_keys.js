import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import path from 'path';

// Load .env from the server folder
dotenv.config({ path: './server/.env' });

const primary = process.env.GEMINI_API_KEY_PRIMARY || process.env.GEMINI_API_KEY;
const secondary = process.env.GEMINI_API_KEY_SECONDARY;

console.log('Primary Key:', primary ? `${primary.substring(0, 10)}...` : 'None');
console.log('Secondary Key:', secondary ? `${secondary.substring(0, 10)}...` : 'None');

async function testKey(keyName, keyVal) {
  if (!keyVal) {
    console.log(`\n--- Testing ${keyName}: skipped (no key) ---`);
    return;
  }
  console.log(`\n--- Testing ${keyName}: ${keyVal.substring(0, 12)}... ---`);
  try {
    const genAI = new GoogleGenerativeAI(keyVal);
    const modelName = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
    console.log(`Using model: ${modelName}`);
    const model = genAI.getGenerativeModel({ model: modelName });
    const result = await model.generateContent("Hello, respond with one word: 'Ready'");
    console.log(`✅ Success! Response: "${result.response.text().trim()}"`);
  } catch (err) {
    console.error(`❌ Failed:`, err.message || err);
  }
}

async function run() {
  await testKey('GEMINI_API_KEY_PRIMARY', primary);
  await testKey('GEMINI_API_KEY_SECONDARY', secondary);
}

run();
