const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = process.env.PORT || 3000;

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

const server = http.createServer((req, res) => {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }

  // GET /
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

  // POST /api/worklist -> Criação de Worklist
  if (req.method === 'POST' && req.url === '/api/worklist') {
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
  console.log(`==================================================`);
});
