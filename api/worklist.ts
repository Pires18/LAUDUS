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

  let body = req.body;
  if (typeof body === 'string' && body.trim()) {
    try {
      body = JSON.parse(body);
    } catch (e) {}
  }

  const localAgentUrl = body?.localAgentUrl;

  if (localAgentUrl) {
    try {
      const targetUrl = `${localAgentUrl.replace(/\/$/, '')}/api/worklist`;
      console.log(`[Vercel Worklist Proxy] Forwarding ${req.method} request to: ${targetUrl}`);
      
      const response = await fetch(targetUrl, {
        method: req.method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      res.statusCode = response.status;
      res.setHeader('Content-Type', 'application/json');
      const responseText = await response.text();
      res.end(responseText);
      return;
    } catch (err: any) {
      console.error('[Vercel Worklist Proxy Error]:', err);
      res.statusCode = 200; // Retorna 200 com success: false para exibir o erro amigável na UI
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        success: false,
        error: `Não foi possível conectar ao Agente Local no Mac Mini via Tailscale. Certifique-se de que o Mac Mini está ativo e com a aplicação em execução. (Detalhes: ${err.message})`
      }));
      return;
    }
  }

  // A geração de worklist física exige gravação de arquivos locais no servidor da clínica (Mac/Windows).
  // Na nuvem (Vercel), esse endpoint deve informar ao usuário de forma amigável sobre essa limitação.
  res.statusCode = 200; // Retorna 200 com JSON informando falha para a UI exibir a mensagem corretamente
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({
    success: false,
    error: 'A geração de arquivos de Worklist local (.wl) exige que o Laud.us esteja rodando localmente no servidor da clínica ou que um Agente Local esteja configurado.'
  }));
}
