import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'
import { exec } from 'child_process'
import fs from 'fs'

// Custom Plugin to handle local Orthanc Worklist files during development
function localOrthancWorklistPlugin() {
  return {
    name: 'local-orthanc-worklist',
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        if (req.url && req.url.startsWith('/api/orthanc-proxy')) {
          const parsedUrl = new URL(req.url, 'http://localhost');
          const targetUrl = parsedUrl.searchParams.get('url');
          if (!targetUrl) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'Missing url parameter' }));
            return;
          }
          try {
            const targetUrlObj = new URL(targetUrl);
            const headers: any = {};
            
            // Extract credentials from query parameters first, then URL, then fallback to orthanc:orthanc
            const queryUsername = parsedUrl.searchParams.get('username');
            const queryPassword = parsedUrl.searchParams.get('password');
            
            let authSource = 'none';
            if (queryUsername && queryPassword) {
              const authString = Buffer.from(`${queryUsername}:${queryPassword}`).toString('base64');
              headers['Authorization'] = `Basic ${authString}`;
              authSource = `query parameter (user: ${queryUsername})`;
            } else if (targetUrlObj.username && targetUrlObj.password) {
              const authString = Buffer.from(`${targetUrlObj.username}:${targetUrlObj.password}`).toString('base64');
              headers['Authorization'] = `Basic ${authString}`;
              authSource = `URL credentials (user: ${targetUrlObj.username})`;
            } else {
              const authString = Buffer.from('admin:123456789').toString('base64');
              headers['Authorization'] = `Basic ${authString}`;
              authSource = 'default fallback (admin:123456789)';
            }

            console.log(`[Orthanc Proxy] Requesting: ${req.method} ${targetUrl} (Auth source: ${authSource})`);

            const fetchOptions: any = {
              method: req.method,
              headers: headers
            };
            
            if (req.method === 'POST') {
              let body = '';
              await new Promise<void>((resolve) => {
                req.on('data', (chunk: any) => { body += chunk; });
                req.on('end', () => { resolve(); });
              });
              fetchOptions.body = body;
              fetchOptions.headers['Content-Type'] = 'application/json';
            }
            const response = await fetch(targetUrl, fetchOptions);
            console.log(`[Orthanc Proxy] Response status: ${response.status} from ${targetUrl}`);
            res.statusCode = response.status;
            response.headers.forEach((value, key) => {
              const lowerKey = key.toLowerCase();
              // Prevent browser from prompting for Basic Auth by stripping WWW-Authenticate
              if (lowerKey !== 'transfer-encoding' && lowerKey !== 'www-authenticate') {
                res.setHeader(key, value);
              }
            });
            const arrayBuffer = await response.arrayBuffer();
            res.end(Buffer.from(arrayBuffer));
          } catch (err: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
          }
          return;
        }

        if (req.url && req.url.startsWith('/api/worklist')) {
          res.setHeader('Content-Type', 'application/json');
          
          if (req.method === 'POST') {
            let body = '';
            req.on('data', (chunk: any) => { body += chunk; });
            req.on('end', () => {
              try {
                const payload = JSON.parse(body);
                // Resolve python executable path dynamically (cross-platform compatibility)
                let pythonExecutable = 'python3';
                if (process.platform === 'win32') {
                  const defaultWinPath = path.join(process.env.USERPROFILE || '', 'AppData/Local/Programs/Python/Python312/python.exe');
                  if (fs.existsSync(defaultWinPath)) {
                    pythonExecutable = `"${defaultWinPath}"`;
                  } else {
                    pythonExecutable = 'python';
                  }
                }

                // Execute python script and pass payload via stdin
                const pythonProcess = exec(`${pythonExecutable} scripts/generate_wl.py`, (error, stdout, stderr) => {
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
                const defaultOutputDir = process.platform === 'win32'
                  ? 'C:\\OrthancServer\\db\\WorklistsDatabase\\'
                  : '/Users/matheuskistenmackerpires/Documents/OrthancServer/db/WorklistsDatabase/';
                const outputDir = payload.outputDir || defaultOutputDir;
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
  plugins: [
    react(),
    localOrthancWorklistPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.svg', 'icons/*.png', 'logo-icon.png'],
      manifest: {
        name: 'LAUD.US',
        short_name: 'LAUD.US',
        description: 'Plataforma Inteligente de Laudos Ultrassonográficos com IA',
        theme_color: '#0568c5',
        background_color: '#0a0a0c',
        display: 'standalone',
        orientation: 'portrait-primary',
        lang: 'pt-BR',
        start_url: '/',
        scope: '/',
        categories: ['medical', 'productivity'],
        icons: [
          { src: '/icons/icon-72x72.png', sizes: '72x72', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-96x96.png', sizes: '96x96', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-128x128.png', sizes: '128x128', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-144x144.png', sizes: '144x144', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-152x152.png', sizes: '152x152', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: '/icons/icon-384x384.png', sizes: '384x384', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
        shortcuts: [
          {
            name: 'Novo Laudo',
            short_name: 'Novo Laudo',
            description: 'Criar um novo laudo',
            url: '/?action=new-exam',
            icons: [{ src: '/icons/icon-96x96.png', sizes: '96x96' }]
          },
          {
            name: 'Worklist',
            short_name: 'Worklist',
            description: 'Ver exames pendentes',
            url: '/?view=worklist',
            icons: [{ src: '/icons/icon-96x96.png', sizes: '96x96' }]
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MiB — handles large main bundle
        runtimeCaching: [
          {
            // Google Fonts
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] }
            }
          },
          {
            // Firebase Auth / Firestore (network-first)
            urlPattern: /^https:\/\/.*\.firebaseio\.com\/.*/i,
            handler: 'NetworkFirst',
            options: { cacheName: 'firebase-cache', networkTimeoutSeconds: 10 }
          },
          {
            urlPattern: /^https:\/\/firestore\.googleapis\.com\/.*/i,
            handler: 'NetworkFirst',
            options: { cacheName: 'firestore-cache', networkTimeoutSeconds: 10 }
          }
        ],
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api\//]
      },
      devOptions: {
        enabled: false // disable SW in dev to avoid conflicts with HMR
      }
    })
  ],
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

