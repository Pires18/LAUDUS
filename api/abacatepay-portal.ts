export default async function handler(req: any, res: any) {
  const origin = req.headers.origin || 'http://localhost:5173';
  
  // Since AbacatePay doesn't have an autonomous portal page for customers,
  // we redirect them back to the settings subscription tab.
  res.writeHead(302, { Location: `${origin}/#settings?tab=assinatura` });
  return res.end();
}
