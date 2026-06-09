export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, x-api-key, anthropic-version, anthropic-beta',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405 });
  }

  try {
    const headers = new Headers();
    headers.set('content-type', 'application/json');
    
    // O header 'anthropic-dangerous-direct-browser-access' NÃO é mais necessário
    // pois a chamada agora parte do servidor Edge da Vercel.

    const apiKey = req.headers.get('x-api-key');
    if (apiKey) headers.set('x-api-key', apiKey);
    
    const anthropicVersion = req.headers.get('anthropic-version');
    if (anthropicVersion) headers.set('anthropic-version', anthropicVersion);
    
    const anthropicBeta = req.headers.get('anthropic-beta');
    if (anthropicBeta) headers.set('anthropic-beta', anthropicBeta);

    const body = await req.text();

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers,
      body,
    });

    return new Response(response.body, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'application/json',
      },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
