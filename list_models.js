import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "AIzaSyFakeKey..."); // We can't really call it without a key, but wait, maybe I can just see the models available?
