const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = process.env.PORT || 3000;

// Segredo compartilhado (opt-in). Quando definido em LAUDUS_AGENT_SECRET, TODA
// requisição de escrita/proxy precisa trazer o header 'x-agent-secret' igual.
// Isso permite expor o AGENTE com segurança via Tailscale Funnel (em vez do
// servidor de desenvolvimento Vite, que não tem autenticação). Se não definido,
// o agente roda aberto (retrocompatível) e avisa no console.
const AGENT_SECRET = process.env.LAUDUS_AGENT_SECRET || '';

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-agent-secret');
}

// Retorna true se autorizado; caso contrário responde 401 e retorna false.
function requireSecret(req, res) {
  if (!AGENT_SECRET) return true; // sem segredo configurado → aberto (aviso no boot)
  const provided = req.headers['x-agent-secret'];
  if (provided && provided === AGENT_SECRET) return true;
  res.statusCode = 401;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ success: false, error: 'Não autorizado: x-agent-secret ausente ou inválido.' }));
  return false;
}

const server = http.createServer((req, res) => {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }

  // GET / (health-check — sempre público, não expõe dados)
  if (req.method === 'GET' && req.url === '/') {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      status: 'online',
      message: 'Laudus Local Agent is running!',
      time: new Date().toISOString()
    }));
    return;
  }

  // /api/orthanc-proxy -> Proxy para o Orthanc local (qualquer método)
  // Permite que o agente seja o ÚNICO gateway exposto via Tailscale: além de
  // gravar arquivos .wl, ele encaminha as chamadas REST ao Orthanc que roda na
  // mesma máquina (localhost:8042). Assim a nuvem não precisa expor o Orthanc
  // separadamente, e o getProxyEndpoint do app pode apontar para este agente.
  if (req.url && req.url.startsWith('/api/orthanc-proxy')) {
    if (!requireSecret(req, res)) return;
    (async () => {
      try {
        const parsedUrl = new URL(req.url, 'http://localhost');
        const targetUrl = parsedUrl.searchParams.get('url');
        if (!targetUrl) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'O parâmetro query "url" é obrigatório.' }));
          return;
        }

        const targetUrlObj = new URL(targetUrl);
        const headers = {};

        // Credenciais do Orthanc: query params ou embutidas na URL. Sem
        // credenciais, segue anônima — NUNCA usar senha default (evita que uma
        // senha embutida no código funcione como backdoor).
        const queryUsername = parsedUrl.searchParams.get('username');
        const queryPassword = parsedUrl.searchParams.get('password');
        if (queryUsername && queryPassword) {
          headers['Authorization'] = `Basic ${Buffer.from(`${queryUsername}:${queryPassword}`).toString('base64')}`;
        } else if (targetUrlObj.username && targetUrlObj.password) {
          headers['Authorization'] = `Basic ${Buffer.from(`${targetUrlObj.username}:${targetUrlObj.password}`).toString('base64')}`;
        }
        if (req.headers['content-type']) headers['Content-Type'] = req.headers['content-type'];

        // Lê o corpo bruto para métodos com payload
        let body;
        if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
          body = await new Promise((resolve, reject) => {
            const chunks = [];
            req.on('data', (chunk) => chunks.push(chunk));
            req.on('end', () => resolve(Buffer.concat(chunks)));
            req.on('error', reject);
          });
        }

        // Timeout: generoso para imagens/instâncias, curto para metadados
        const controller = new AbortController();
        const heavy = req.method === 'GET' && /\/(instances|preview|rendered|wado|file)/.test(targetUrl);
        const timeoutId = setTimeout(() => controller.abort(), heavy ? 30000 : 10000);

        const response = await fetch(targetUrl, { method: req.method, headers, body, signal: controller.signal });
        clearTimeout(timeoutId);

        res.statusCode = response.status;
        response.headers.forEach((value, key) => {
          const k = key.toLowerCase();
          if (k !== 'transfer-encoding' && k !== 'www-authenticate' && k !== 'content-encoding' && k !== 'connection' && k !== 'keep-alive') {
            res.setHeader(key, value);
          }
        });
        const arrayBuffer = await response.arrayBuffer();
        res.end(Buffer.from(arrayBuffer));
      } catch (err) {
        console.error('[Agent Orthanc Proxy] Erro:', err.message);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: err.message || 'Erro ao conectar ao Orthanc local.' }));
      }
    })();
    return;
  }

  // POST /api/worklist -> Criação de Worklist
  if (req.method === 'POST' && req.url === '/api/worklist') {
    if (!requireSecret(req, res)) return;
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        
        // Caminho para o script python
        const pythonScriptPath = path.join(__dirname, 'generate_wl.py');
        
        // Tenta executar com 'python' ou 'python3' ou 'py'
        const commandsToTry = ['python', 'python3', 'py'];
        let commandIndex = 0;
        
        function runPython(cmd) {
          console.log(`[Agent] Tentando gerar worklist com comando: ${cmd}`);
          const pyProcess = spawn(cmd, [pythonScriptPath]);
          let stdout = '';
          let stderr = '';
          
          pyProcess.stdout.on('data', data => { stdout += data; });
          pyProcess.stderr.on('data', data => { stderr += data; });
          
          pyProcess.on('close', code => {
            if (code === 0) {
              console.log('[Agent] Worklist gerado com sucesso via Python');
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(stdout);
            } else {
              console.error(`[Agent] Python exit code ${code}. Stderr: ${stderr}`);
              
              // Se falhou por comando não encontrado, tenta o próximo
              if ((stderr.includes('not found') || stderr.includes('não reconhecido') || stderr.includes('ENOENT') || stderr === '') && commandIndex < commandsToTry.length - 1) {
                commandIndex++;
                runPython(commandsToTry[commandIndex]);
              } else {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ 
                  success: false, 
                  error: `Falha na execução do Python: ${stderr || 'Erro desconhecido.'}` 
                }));
              }
            }
          });
          
          pyProcess.on('error', err => {
            console.error(`[Agent] Erro ao spawnar processo: ${err.message}`);
            if (commandIndex < commandsToTry.length - 1) {
              commandIndex++;
              runPython(commandsToTry[commandIndex]);
            } else {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ 
                success: false, 
                error: `Erro ao iniciar script do Python (pydicom): ${err.message}` 
              }));
            }
          });
          
          // Envia o JSON do payload para o stdin do script python
          pyProcess.stdin.write(JSON.stringify(payload));
          pyProcess.stdin.end();
        }
        
        runPython(commandsToTry[commandIndex]);
        
      } catch (err) {
        console.error('[Agent] Erro ao processar payload JSON:', err);
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: false, error: 'JSON inválido no corpo da requisição.' }));
      }
    });
    return;
  }

  // DELETE /api/worklist -> Remoção de Worklist
  if (req.method === 'DELETE' && req.url === '/api/worklist') {
    if (!requireSecret(req, res)) return;
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        const { examId, outputDir } = payload;
        
        if (!examId) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: false, error: 'O campo examId é obrigatório.' }));
          return;
        }
        
        // Mapeia pasta final
        let dir = outputDir;
        if (!dir) {
          const isWindows = process.platform === 'win32';
          dir = isWindows 
            ? 'C:\\OrthancServer\\db\\WorklistsDatabase\\'
            : '/Volumes/MATHEUS SSD/OrthancServer/db/WorklistsDatabase/';
        }
        
        const filePath = path.join(dir, `agendamento_${examId}.wl`);
        console.log(`[Agent] Tentando remover arquivo .wl: ${filePath}`);
        
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log(`[Agent] Arquivo ${filePath} removido com sucesso.`);
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: true, message: 'Arquivo .wl removido com sucesso.' }));
        } else {
          console.log(`[Agent] Arquivo .wl não existe mais: ${filePath}`);
          res.statusCode = 200; // Retorna 200 mesmo se não existir para evitar erros na UI
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: true, message: 'Arquivo .wl já estava removido.' }));
        }
        
      } catch (err) {
        console.error('[Agent] Erro ao deletar arquivo .wl:', err);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // 404 Not Found
  res.statusCode = 404;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ success: false, error: 'Endpoint não encontrado.' }));
});

server.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`  LAUD.US Local Agent rodando na porta ${PORT}      `);
  console.log(`  Pronto para intermediar conexões DICOM / .wl   `);
  if (AGENT_SECRET) {
    console.log(`  🔒 Autenticação ATIVA (x-agent-secret exigido)  `);
  } else {
    console.log(`  ⚠️  SEM autenticação. Se for expor via Funnel,   `);
    console.log(`     defina LAUDUS_AGENT_SECRET antes de publicar. `);
  }
  console.log(`==================================================`);
});
