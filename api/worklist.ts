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

  // A geração de worklist física exige gravação de arquivos locais no servidor da clínica (Mac/Windows).
  // Na nuvem (Vercel), esse endpoint deve informar ao usuário de forma amigável sobre essa limitação.
  res.statusCode = 200; // Retorna 200 com JSON informando falha para a UI exibir a mensagem corretamente
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({
    success: false,
    error: 'A geração de arquivos de Worklist local (.wl) exige que o Laud.us esteja rodando localmente no servidor da clínica.'
  }));
}
