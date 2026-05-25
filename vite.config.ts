import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { exec } from 'child_process'
import fs from 'fs'

// Custom Plugin to handle local Orthanc Worklist files during development
function localOrthancWorklistPlugin() {
  return {
    name: 'local-orthanc-worklist',
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        if (req.url && req.url.startsWith('/api/worklist')) {
          res.setHeader('Content-Type', 'application/json');
          
          if (req.method === 'POST') {
            let body = '';
            req.on('data', (chunk: any) => { body += chunk; });
            req.on('end', () => {
              try {
                const payload = JSON.parse(body);
                // Execute python script and pass payload via stdin
                const pythonProcess = exec('python3 scripts/generate_wl.py', (error, stdout, stderr) => {
                  if (error) {
                    res.statusCode = 500;
                    res.end(JSON.stringify({ success: false, error: stderr.trim() || error.message }));
                  } else {
                    res.end(stdout);
                  }
                });
                pythonProcess.stdin?.write(JSON.stringify(payload));
                pythonProcess.stdin?.end();
              } catch (err: any) {
                res.statusCode = 400;
                res.end(JSON.stringify({ success: false, error: err.message }));
              }
            });
          } else if (req.method === 'DELETE') {
            let body = '';
            req.on('data', (chunk: any) => { body += chunk; });
            req.on('end', () => {
              try {
                const payload = JSON.parse(body);
                const examId = payload.examId;
                if (!examId) {
                  res.statusCode = 400;
                  res.end(JSON.stringify({ success: false, error: "O campo 'examId' e obrigatorio." }));
                  return;
                }
                const outputDir = payload.outputDir || '/Users/matheuskistenmackerpires/Documents/OrthancServer/db/WorklistsDatabase/';
                const filePath = path.join(outputDir, `agendamento_${examId}.wl`);
                if (fs.existsSync(filePath)) {
                  fs.unlinkSync(filePath);
                  res.end(JSON.stringify({ success: true, message: `Arquivo de worklist agendamento_${examId}.wl removido com sucesso.` }));
                } else {
                  res.end(JSON.stringify({ success: true, message: `Arquivo não encontrado, nada a remover.` }));
                }
              } catch (err: any) {
                res.statusCode = 400;
                res.end(JSON.stringify({ success: false, error: err.message }));
              }
            });
          } else {
            res.statusCode = 405;
            res.end(JSON.stringify({ error: 'Method Not Allowed' }));
          }
        } else {
          next();
        }
      });
    }
  };
}

export default defineConfig({
  plugins: [react(), localOrthancWorklistPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    host: '0.0.0.0',
    allowedHosts: true,
    open: true
  }
})

