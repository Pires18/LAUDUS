const fs = require('fs');

function getSafeModel(modelName) {
  if (!modelName) return 'gemini-1.5-flash';
  const raw = modelName.toLowerCase();
  if (raw.includes('3.5-flash') || raw.includes('3-flash')) return 'gemini-1.5-flash';
  if (raw.includes('3.1-pro') || raw.includes('2.5-pro')) return 'gemini-1.5-pro';
  if (raw.includes('2.0-flash-thinking')) return 'gemini-2.0-flash-thinking-exp';
  if (raw.includes('2.0-flash')) return 'gemini-2.0-flash';
  if (raw.includes('2.0-pro')) return 'gemini-2.0-pro-exp';
  
  // Default fallbacks to 1.5 since they are the most stable globally
  if (raw.includes('flash')) return 'gemini-1.5-flash';
  if (raw.includes('pro')) return 'gemini-1.5-pro';
  
  return 'gemini-1.5-flash';
}
