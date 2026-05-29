import type { IncomingMessage, ServerResponse } from 'http';

// Desabilita o bodyParser padrão do Vercel Serverless Functions.
// Isso impede que a Vercel tente analisar payloads binários brutos (como arquivos DICOM)
// como JSON ou strings UTF-8, o que poderia corromper os dados enviados.
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: any, res: any) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Preflight CORS request
  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }

  // Robust parsing of query parameters
  let query = req.query || {};
  if (!req.query && req.url) {
    try {
      const host = req.headers.host || 'localhost';
      const protocol = req.headers['x-forwarded-proto'] || 'http';
      const parsedUrl = new URL(req.url, `${protocol}://${host}`);
      query = Object.fromEntries(parsedUrl.searchParams.entries());
    } catch (e) {
      console.error('[Vercel Orthanc Proxy] Failed to parse URL:', e);
    }
  }

  const targetUrl = query.url as string | undefined;

  if (!targetUrl) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'O parâmetro query "url" é obrigatório.' }));
    return;
  }

  try {
    const targetUrlObj = new URL(targetUrl);
    const headers: Record<string, string> = {};

    // Extract credentials: query params first, then from the URL itself, otherwise default
    const queryUsername = query.username as string | undefined;
    const queryPassword = query.password as string | undefined;

    if (queryUsername && queryPassword) {
      const authString = Buffer.from(`${queryUsername}:${queryPassword}`).toString('base64');
      headers['Authorization'] = `Basic ${authString}`;
    } else if (targetUrlObj.username && targetUrlObj.password) {
      const authString = Buffer.from(`${targetUrlObj.username}:${targetUrlObj.password}`).toString('base64');
      headers['Authorization'] = `Basic ${authString}`;
    } else {
      // Default fallback
      const authString = Buffer.from('admin:123456789').toString('base64');
      headers['Authorization'] = `Basic ${authString}`;
    }

    // Forward content-type if present
    if (req.headers['content-type']) {
      headers['Content-Type'] = req.headers['content-type'];
    }

    // Read raw request body stream directly (since bodyParser is disabled)
    let body: any = undefined;
    if (['POST', 'PUT', 'PATCH'].includes(req.method || '')) {
      body = await new Promise<Buffer>((resolve, reject) => {
        const chunks: Buffer[] = [];
        req.on('data', (chunk: Buffer) => chunks.push(chunk));
        req.on('end', () => resolve(Buffer.concat(chunks)));
        req.on('error', (err: Error) => reject(err));
      });
    }

    // Perform fetch to target Orthanc server
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: headers,
      body: body,
    });

    res.statusCode = response.status;

    // Forward response headers (ignoring transfer encoding and basic auth prompts)
    response.headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase();
      if (
        lowerKey !== 'transfer-encoding' &&
        lowerKey !== 'www-authenticate' &&
        lowerKey !== 'content-encoding' &&
        lowerKey !== 'connection' &&
        lowerKey !== 'keep-alive'
      ) {
        res.setHeader(key, value);
      }
    });

    const arrayBuffer = await response.arrayBuffer();
    res.end(Buffer.from(arrayBuffer));
  } catch (err: any) {
    console.error('[Vercel Orthanc Proxy Error]:', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: err.message || 'Erro ao conectar ao servidor Orthanc.' }));
  }
}
