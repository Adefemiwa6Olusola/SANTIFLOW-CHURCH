import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
dotenv.config();

const key = process.env.GEMINI_API_KEY_PRIMARY;

async function listModels() {
  console.log(`Listing models using key: ${key ? key.substring(0, 10) + '...' : 'undefined'}`);
  if (!key) return;

  try {
    const genAI = new GoogleGenerativeAI(key);
    // GoogleGenerativeAI SDK does not expose listModels directly on the main class in some versions,
    // so we will query it using fetch to the standard Google endpoint.
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
    const data = await response.json();
    if (data.models) {
      console.log('Available models:');
      data.models.forEach(m => {
        console.log(`- ${m.name} (methods: ${m.supportedGenerationMethods.join(', ')})`);
      });
    } else {
      console.log('No models returned. Error:', data);
    }
  } catch (err) {
    console.error('Failed to list models:', err);
  }
}

listModels();
