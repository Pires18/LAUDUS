const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const PORT = process.env.PORT || 3000;

// Segredo compartilhado (single-tenant). Quando definido em LAUDUS_AGENT_SECRET,
// toda requisição de escrita/proxy precisa trazer 'x-agent-secret' igual. Usado
// nas VMs DEDICADAS (um cliente por VM) e no dev local.
const AGENT_SECRET = process.env.LAUDUS_AGENT_SECRET || '';

// ── MULTI-TENANT (VM compartilhada) ──────────────────────────────────────────
// Se LAUDUS_TENANTS_DIR estiver definido, o agente opera em modo MULTI-TENANT:
// cada cliente tem uma pasta ${TENANTS_DIR}/<tenantId>/ com um tenant.json:
//   { "secret": "...", "worklistDir": "...", "httpPort": 8101, "dicomPort": 4301 }
// Toda requisição DEVE trazer ?tenantId=<id> e o segredo daquele tenant. O agente
// resolve pasta/porta pelo tenant e NUNCA cruza clientes (personificação).
const TENANTS_DIR = process.env.LAUDUS_TENANTS_DIR || '';

// Admin (só na VM compartilhada): provisiona tenants sob demanda. O serverless
// do Vercel chama /api/admin/tenant com este segredo. Sem ele, o endpoint fica off.
const ADMIN_SECRET = process.env.LAUDUS_ADMIN_SECRET || '';
const TENANT_SCRIPT = process.env.LAUDUS_TENANT_SCRIPT || '/opt/pacs-tenant.sh';
const AGENT_TS_NET = process.env.LAUDUS_TS_NET || 'tail861dda.ts.net';

// Endurecimento opt-in (anti-SSRF) para o modo single-tenant.
const ALLOWED_HOSTS = (process.env.LAUDUS_ALLOWED_HOSTS || '')
  .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);

// Diretório de worklist fixo (single-tenant); no multi-tenant vem do tenant.json.
const WORKLIST_DIR = process.env.LAUDUS_WORKLIST_DIR || '';

// Endpoints de metadados de nuvem são SEMPRE bloqueados no proxy.
const BLOCKED_HOSTS = new Set(['169.254.169.254', 'metadata.google.internal']);

function isProxyTargetAllowed(targetUrlObj) {
  const host = (targetUrlObj.hostname || '').toLowerCase();
  if (BLOCKED_HOSTS.has(host)) return false;
  if (ALLOWED_HOSTS.length > 0) return ALLOWED_HOSTS.includes(host);
  return true;
}

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-agent-secret');
}

function parseUrl(req) {
  try { return new URL(req.url, 'http://localhost'); } catch { return new URL('http://localhost/'); }
}

function getProvidedSecret(req, u) {
  return req.headers['x-agent-secret'] || u.searchParams.get('agentSecret') || null;
}

// tenantId seguro: alfanumérico/_/- (compõe caminho de pasta).
function safeTenantId(id) {
  return typeof id === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(id) ? id : null;
}

// Carrega o tenant a partir de ?tenantId= (só no modo multi-tenant). Blindado
// contra path-traversal: o caminho resolvido precisa ficar dentro de TENANTS_DIR.
function loadTenant(u) {
  if (!TENANTS_DIR) return null;
  const tid = safeTenantId(u.searchParams.get('tenantId'));
  if (!tid) return null;
  const base = path.resolve(TENANTS_DIR);
  const file = path.resolve(path.join(base, tid, 'tenant.json'));
  if (file !== path.join(base, tid, 'tenant.json') && !file.startsWith(base + path.sep)) return null;
  try {
    const t = JSON.parse(fs.readFileSync(file, 'utf8'));
    return { tenantId: tid, secret: t.secret, worklistDir: t.worklistDir, httpPort: t.httpPort, dicomPort: t.dicomPort };
  } catch { return null; }
}

function unauthorized(res, msg) {
  res.statusCode = 401;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ success: false, error: msg || 'Não autorizado: segredo do agente ausente ou inválido.' }));
}

// Autoriza a requisição e resolve o tenant. Retorna { ok, tenant }.
// - Multi-tenant (TENANTS_DIR): exige tenantId válido + segredo daquele tenant.
// - Single-tenant: exige AGENT_SECRET (ou aberto se não configurado).
function checkAuth(req, res, u) {
  const provided = getProvidedSecret(req, u);
  if (TENANTS_DIR) {
    const tenant = loadTenant(u);
    if (!tenant) { unauthorized(res, 'tenantId inválido ou ausente (servidor multi-tenant).'); return { ok: false }; }
    if (provided && provided === tenant.secret) return { ok: true, tenant };
    unauthorized(res); return { ok: false };
  }
  if (!AGENT_SECRET) return { ok: true, tenant: null };
  if (provided && provided === AGENT_SECRET) return { ok: true, tenant: null };
  unauthorized(res); return { ok: false };
}

const server = http.createServer((req, res) => {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') { res.statusCode = 200; res.end(); return; }

  const u = parseUrl(req);
  const pathname = u.pathname;

  // GET / (health-check — público, não expõe dados)
  if (req.method === 'GET' && pathname === '/') {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ status: 'online', message: 'Laudus Local Agent is running!', mode: TENANTS_DIR ? 'multi-tenant' : 'single-tenant', time: new Date().toISOString() }));
    return;
  }

  // POST /api/admin/tenant -> provisiona um tenant na VM compartilhada (admin).
  // Protegido por x-admin-secret. Executa pacs-tenant.sh e devolve os dados JSON.
  if (req.method === 'POST' && pathname === '/api/admin/tenant') {
    if (!ADMIN_SECRET || req.headers['x-admin-secret'] !== ADMIN_SECRET) {
      res.statusCode = 401; res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: false, error: 'Admin não autorizado.' })); return;
    }
    let body = '';
    req.on('data', c => { body += c; });
    req.on('end', () => {
      let plan = 'pro';
      try { plan = JSON.parse(body || '{}').plan || 'pro'; } catch {}
      if (!['starter', 'pro', 'dedicado'].includes(plan)) plan = 'pro';
      const env = { ...process.env, LAUDUS_JSON: '1', TENANTS_DIR: TENANTS_DIR || '/opt/tenants', TS_NET: AGENT_TS_NET };
      let p;
      try { p = spawn('bash', [TENANT_SCRIPT, 'create', '', plan], { env }); }
      catch (e) { res.statusCode = 500; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ success: false, error: 'Falha ao executar script: ' + e.message })); return; }
      let out = ''; let err = '';
      p.stdout.on('data', d => { out += d; });
      p.stderr.on('data', d => { err += d; });
      p.on('error', e => { res.statusCode = 500; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ success: false, error: 'Falha ao executar script: ' + e.message })); });
      p.on('close', code => {
        const line = out.trim().split('\n').filter(l => l.trim().startsWith('{')).pop() || '';
        let data = null; try { data = JSON.parse(line); } catch {}
        if (code === 0 && data) {
          res.statusCode = 200; res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: true, ...data }));
        } else {
          res.statusCode = 500; res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: false, error: (err.trim() || 'Falha ao criar tenant.').slice(-300) }));
        }
      });
    });
    return;
  }

  // /api/orthanc-proxy -> proxy para o Orthanc (multi-tenant: para o Orthanc do tenant)
  if (pathname === '/api/orthanc-proxy') {
    const auth = checkAuth(req, res, u); if (!auth.ok) return;
    const tenant = auth.tenant;
    (async () => {
      try {
        const rawUrl = u.searchParams.get('url');
        if (!rawUrl) {
          res.statusCode = 400; res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'O parâmetro query "url" é obrigatório.' })); return;
        }

        // No multi-tenant, ignoramos o host informado e forçamos o Orthanc do
        // tenant (127.0.0.1:<httpPort>) — preservando só path+query.
        let targetUrl;
        if (tenant) {
          const src = new URL(rawUrl);
          targetUrl = `http://127.0.0.1:${tenant.httpPort}${src.pathname}${src.search}`;
        } else {
          targetUrl = rawUrl;
          const targetUrlObj = new URL(targetUrl);
          if (!isProxyTargetAllowed(targetUrlObj)) {
            res.statusCode = 403; res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Destino não permitido pelo agente.' })); return;
          }
        }
        const targetUrlObj = new URL(targetUrl);

        const headers = {};
        const queryUsername = u.searchParams.get('username');
        const queryPassword = u.searchParams.get('password');
        if (queryUsername && queryPassword) {
          headers['Authorization'] = `Basic ${Buffer.from(`${queryUsername}:${queryPassword}`).toString('base64')}`;
        } else if (targetUrlObj.username && targetUrlObj.password) {
          headers['Authorization'] = `Basic ${Buffer.from(`${targetUrlObj.username}:${targetUrlObj.password}`).toString('base64')}`;
        }
        if (req.headers['content-type']) headers['Content-Type'] = req.headers['content-type'];

        let body;
        if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
          body = await new Promise((resolve, reject) => {
            const chunks = [];
            req.on('data', (chunk) => chunks.push(chunk));
            req.on('end', () => resolve(Buffer.concat(chunks)));
            req.on('error', reject);
          });
        }

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
        res.statusCode = 500; res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: err.message || 'Erro ao conectar ao Orthanc.' }));
      }
    })();
    return;
  }

  // POST /api/worklist -> criação/ping de worklist
  if (req.method === 'POST' && pathname === '/api/worklist') {
    const auth = checkAuth(req, res, u); if (!auth.ok) return;
    const tenant = auth.tenant;
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);

        // Diretório de saída: multi-tenant → pasta do tenant; senão WORKLIST_DIR.
        if (tenant && tenant.worklistDir) payload.outputDir = tenant.worklistDir;
        else if (WORKLIST_DIR) payload.outputDir = WORKLIST_DIR;

        const pythonScriptPath = path.join(__dirname, 'generate_wl.py');
        const commandsToTry = ['python', 'python3', 'py'];
        let commandIndex = 0;
        let responded = false;
        function respond(status, bodyStr) {
          if (responded) return; responded = true;
          res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.end(bodyStr);
        }
        function tryNextOrFail(err) {
          if (commandIndex < commandsToTry.length - 1) { commandIndex++; runPython(commandsToTry[commandIndex]); }
          else respond(500, JSON.stringify({ success: false, error: `Erro ao iniciar script do Python (pydicom): ${err.message}` }));
        }
        function runPython(cmd) {
          console.log(`[Agent] Tentando gerar worklist com comando: ${cmd}`);
          let settled = false;
          let pyProcess;
          try { pyProcess = spawn(cmd, [pythonScriptPath]); } catch (err) { tryNextOrFail(err); return; }
          let stdout = ''; let stderr = '';
          pyProcess.stdout.on('data', data => { stdout += data; });
          pyProcess.stderr.on('data', data => { stderr += data; });
          pyProcess.on('error', err => {
            if (settled) return; settled = true;
            console.error(`[Agent] Erro ao spawnar processo (${cmd}): ${err.message}`); tryNextOrFail(err);
          });
          pyProcess.on('close', code => {
            if (settled) return; settled = true;
            if (code === 0) { console.log('[Agent] Worklist gerado com sucesso via Python'); respond(200, stdout); }
            else { console.error(`[Agent] Python (${cmd}) exit code ${code}. Stderr: ${stderr}`); respond(500, JSON.stringify({ success: false, error: `Falha na execução do Python: ${stderr || 'Erro desconhecido.'}` })); }
          });
          try { pyProcess.stdin.write(JSON.stringify(payload)); pyProcess.stdin.end(); } catch (err) { /* tratado por 'error' */ }
        }
        runPython(commandsToTry[commandIndex]);
      } catch (err) {
        console.error('[Agent] Erro ao processar payload JSON:', err);
        res.statusCode = 400; res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: false, error: 'JSON inválido no corpo da requisição.' }));
      }
    });
    return;
  }

  // DELETE /api/worklist -> remoção de worklist
  if (req.method === 'DELETE' && pathname === '/api/worklist') {
    const auth = checkAuth(req, res, u); if (!auth.ok) return;
    const tenant = auth.tenant;
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        const { examId, outputDir } = payload;
        if (!examId) {
          res.statusCode = 400; res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: false, error: 'O campo examId é obrigatório.' })); return;
        }
        if (!/^[A-Za-z0-9_-]+$/.test(String(examId))) {
          res.statusCode = 400; res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: false, error: 'examId inválido.' })); return;
        }
        let dir = (tenant && tenant.worklistDir) || WORKLIST_DIR || outputDir;
        if (!dir) {
          dir = process.platform === 'win32'
            ? 'C:\\OrthancServer\\db\\WorklistsDatabase\\'
            : path.join(os.homedir(), 'OrthancServer', 'db', 'WorklistsDatabase');
        }
        const filePath = path.join(dir, `agendamento_${examId}.wl`);
        console.log(`[Agent] Tentando remover arquivo .wl: ${filePath}`);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          res.statusCode = 200; res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: true, message: 'Arquivo .wl removido com sucesso.' }));
        } else {
          res.statusCode = 200; res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: true, message: 'Arquivo .wl já estava removido.' }));
        }
      } catch (err) {
        console.error('[Agent] Erro ao deletar arquivo .wl:', err);
        res.statusCode = 500; res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  res.statusCode = 404;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ success: false, error: 'Endpoint não encontrado.' }));
});

server.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`  LAUD.US Local Agent rodando na porta ${PORT}      `);
  if (TENANTS_DIR) {
    console.log(`  🏢 Modo MULTI-TENANT (dir: ${TENANTS_DIR})`);
    console.log(`     Cada requisição exige ?tenantId= + segredo do tenant.`);
  } else if (AGENT_SECRET) {
    console.log(`  🔒 Single-tenant, autenticação ATIVA (x-agent-secret).`);
  } else {
    console.log(`  ⚠️  Single-tenant SEM autenticação. Defina LAUDUS_AGENT_SECRET`);
    console.log(`     antes de expor via Funnel.`);
  }
  console.log(`==================================================`);
});
