import { GoogleGenerativeAI } from '@google/generative-ai';

async function run() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'fake');
  try {
    // We can't list models without a valid key, but let's try
    // We will extract the API key from localSettings if possible
  } catch(e) {
    console.log(e);
  }
}
run();
