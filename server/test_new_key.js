import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
dotenv.config();

const key = process.env.GEMINI_API_KEY_PRIMARY;
const models = ['gemini-2.5-flash', 'gemini-3.5-flash'];

async function testKey() {
  console.log(`Testing API Key from .env: ${key ? key.substring(0, 10) + '...' : 'undefined'}`);
  if (!key) return;

  for (const modelName of models) {
    console.log(`\n--- Testing model: ${modelName} ---`);
    try {
      const genAI = new GoogleGenerativeAI(key);
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent("Hello, respond with one word: 'Success'");
      console.log(`✅ Success! Response: "${result.response.text().trim()}"`);
    } catch (err) {
      console.error(`❌ Failed:`, err.message || err);
    }
  }
}

testKey();
