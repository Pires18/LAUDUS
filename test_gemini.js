import { GoogleGenerativeAI } from '@google/generative-ai';

async function run() {
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'fake_key');
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    // This will fail due to fake key, but the error message will be "API key not valid"
    // rather than "model not found" if the model is fine, or maybe "model not found" comes first.
    // Actually, I can't test model existence without a real key easily.
  } catch (err) {
    console.error(err);
  }
}
run();
