export function robustJsonParse<T>(text: string): T {
  if (!text) throw new Error('Texto vazio fornecido para extração de JSON.');
  
  let cleaned = text.trim();
  
  // Extract content from markdown blocks if present
  const jsonBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/i;
  const match = cleaned.match(jsonBlockRegex);
  if (match && match[1]) {
    cleaned = match[1].trim();
  } else {
    // If no markdown block, try to find the first '{' or '[' and last '}' or ']'
    const firstBrace = cleaned.indexOf('{');
    const firstBracket = cleaned.indexOf('[');
    
    let startIndex = -1;
    if (firstBrace !== -1 && firstBracket !== -1) {
      startIndex = Math.min(firstBrace, firstBracket);
    } else if (firstBrace !== -1) {
      startIndex = firstBrace;
    } else if (firstBracket !== -1) {
      startIndex = firstBracket;
    }
    
    if (startIndex !== -1) {
      const lastBrace = cleaned.lastIndexOf('}');
      const lastBracket = cleaned.lastIndexOf(']');
      const endIndex = Math.max(lastBrace, lastBracket);
      
      if (endIndex > startIndex) {
        cleaned = cleaned.substring(startIndex, endIndex + 1);
      }
    }
  }

  try {
    return JSON.parse(cleaned) as T;
  } catch (err: any) {
    // Attempt basic fix for trailing commas
    try {
      const fixedCleaned = cleaned.replace(/,\s*([\]}])/g, '$1');
      return JSON.parse(fixedCleaned) as T;
    } catch (err2: any) {
      throw new Error(`JSON parsing falhou. Original error: ${err.message}. Fixed error: ${err2.message}. Texto extraído: ${cleaned}`);
    }
  }
}
