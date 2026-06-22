export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // Resolve a URL base: env var tem prioridade (Vercel), depois o host do request
  const publicBase = (process.env.VITE_PUBLIC_URL || '').replace(/\/$/, '');
  const hostBase = req.headers.host
    ? `https://${req.headers.host}`
    : 'http://localhost:5173';
  const base = publicBase || hostBase;

  // AbacatePay não tem portal de cliente autônomo; redireciona para a aba de assinatura
  const target = `${base}/#settings?tab=assinatura`;
  res.writeHead(302, { Location: target });
  return res.end();
}
