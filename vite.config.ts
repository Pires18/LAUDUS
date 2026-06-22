import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'
import { spawn } from 'child_process'
import fs from 'fs'

// Custom Plugin to handle local Orthanc Worklist files during development
function localOrthancWorklistPlugin() {
  return {
    name: 'local-orthanc-worklist',
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        // Allow CORS for all local API routes
        if (req.url && req.url.includes('/api/')) {
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

          if (req.method === 'OPTIONS') {
            res.statusCode = 200;
            res.end();
            return;
          }
        }

        if (req.url && req.url.includes('/api/orthanc-proxy')) {
          const parsedUrl = new URL(req.url, 'http://localhost');
          const targetUrl = parsedUrl.searchParams.get('url');
          if (!targetUrl) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'Missing url parameter' }));
            return;
          }
          try {
            let resolvedTargetUrl = targetUrl;
            // Se estiver rodando dentro do Docker, substitui localhost/127.0.0.1 por host.docker.internal para conseguir conectar ao host
            if (process.env.RUNNING_IN_DOCKER === 'true') {
              resolvedTargetUrl = targetUrl
                .replace('://localhost:', '://host.docker.internal:')
                .replace('://127.0.0.1:', '://host.docker.internal:');
            }
            const targetUrlObj = new URL(resolvedTargetUrl);
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

            console.log(`[Orthanc Proxy] Requesting: ${req.method} ${resolvedTargetUrl} (Auth source: ${authSource})`);

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
            const controller = new AbortController();
            
            // Define timeout: generous for metadata/search (10s), very slow for heavy images (30s)
            let timeoutDuration = 10000; // 10 seconds default
            if (req.method === 'GET' && (
                resolvedTargetUrl.includes('/instances') || 
                resolvedTargetUrl.includes('preview') || 
                resolvedTargetUrl.includes('rendered') || 
                resolvedTargetUrl.includes('wado') ||
                resolvedTargetUrl.includes('file')
            )) {
                timeoutDuration = 30000; // 30 seconds for images
            }
            
            const timeoutId = setTimeout(() => controller.abort(), timeoutDuration);
            fetchOptions.signal = controller.signal;

            const response = await fetch(resolvedTargetUrl, fetchOptions);
            clearTimeout(timeoutId);

            console.log(`[Orthanc Proxy] Response status: ${response.status} from ${resolvedTargetUrl}`);
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

        if (req.url && req.url.includes('/api/worklist')) {
          res.setHeader('Content-Type', 'application/json');
          
          if (req.method === 'POST') {
            let body = '';
            req.on('data', (chunk: any) => { body += chunk; });
            req.on('end', () => {
              try {
                const payload = JSON.parse(body);
                // Se rodando no Docker, força o diretório da worklist para a montagem de volume
                // Determine output directory based on environment variables or OS fallback
                const defaultOutputDir = process.platform === 'win32'
                  ? 'C:\\OrthancServer\\db\\WorklistsDatabase\\'
                  : '';

                payload.outputDir = process.env.VITE_ORTHANC_WORKLIST_DIR || payload.outputDir || defaultOutputDir;
                
                if (process.env.RUNNING_IN_DOCKER === 'true') {
                  payload.outputDir = '/app/pacs-worklist/';
                }
                
                // Resolve python executable — try env var first, then a fallback chain
                const pythonScriptPath = path.resolve(__dirname, 'scripts', 'generate_wl.py');

                function buildPythonCandidates(): string[] {
                  if (process.env.VITE_PYTHON_PATH) return [process.env.VITE_PYTHON_PATH];
                  if (process.platform === 'win32') {
                    const userProfile = process.env.USERPROFILE || '';
                    const candidates: string[] = [];
                    // Check common Windows install paths for Python 3.9 – 3.13
                    for (const ver of ['313', '312', '311', '310', '39']) {
                      const p = path.join(userProfile, `AppData/Local/Programs/Python/Python${ver}/python.exe`);
                      if (fs.existsSync(p)) candidates.push(p);
                    }
                    // Always append generic shell commands as last resort
                    candidates.push('python', 'py', 'python3');
                    return candidates;
                  }
                  return ['python3', 'python'];
                }

                const candidates = buildPythonCandidates();
                let candidateIndex = 0;

                function tryNextPython() {
                  if (candidateIndex >= candidates.length) {
                    res.statusCode = 500;
                    res.end(JSON.stringify({ success: false, error: 'Python não encontrado. Instale Python 3.x e o módulo pydicom (pip install pydicom).' }));
                    return;
                  }
                  const cmd = candidates[candidateIndex++];
                  const pyProcess = spawn(cmd, [pythonScriptPath], { shell: process.platform === 'win32' });
                  let stdout = '';
                  let stderr = '';
                  pyProcess.stdout.on('data', (d: Buffer) => { stdout += d; });
                  pyProcess.stderr.on('data', (d: Buffer) => { stderr += d; });
                  pyProcess.on('error', () => { tryNextPython(); });
                  pyProcess.on('close', (code: number) => {
                    if (code === 0) {
                      res.statusCode = 200;
                      res.setHeader('Content-Type', 'application/json');
                      res.end(stdout);
                    } else if (stderr.includes('No module named') || stderr.includes('ModuleNotFoundError')) {
                      res.statusCode = 500;
                      res.end(JSON.stringify({ success: false, error: `Módulo Python ausente: ${stderr.trim()}. Execute: pip install pydicom` }));
                    } else if ((stderr.includes('not found') || stderr.includes('não reconhecido') || stderr === '') && candidateIndex < candidates.length) {
                      tryNextPython();
                    } else {
                      res.statusCode = 500;
                      res.end(JSON.stringify({ success: false, error: stderr.trim() || `Python saiu com código ${code}` }));
                    }
                  });
                  pyProcess.stdin.write(JSON.stringify(payload));
                  pyProcess.stdin.end();
                }

                tryNextPython();
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
                  : '';
                let outputDir = process.env.VITE_ORTHANC_WORKLIST_DIR || payload.outputDir || defaultOutputDir;
                if (process.env.RUNNING_IN_DOCKER === 'true') {
                  outputDir = '/app/pacs-worklist/';
                }
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
        } else if (
          req.url && (
            req.url.startsWith('/api/abacatepay-checkout') ||
            req.url.startsWith('/api/abacatepay-webhook') ||
            req.url.startsWith('/api/abacatepay-portal') ||
            req.url.startsWith('/api/abacatepay-test') ||
            req.url.startsWith('/api/reset-monthly-reports') ||
            req.url.startsWith('/api/promote-admin') ||
            req.url.startsWith('/api/abacatepay-cancel')
          )
        ) {
          const parsedUrl = new URL(req.url, 'http://localhost');
          const pathName = parsedUrl.pathname;

          const runServerless = async (filePath: string) => {
            try {
              const mod = await server.ssrLoadModule(filePath);
              const handler = mod.default || mod;

              res.status = (code: number) => { res.statusCode = code; return res; };
              res.json = (data: any) => {
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(data));
                return res;
              };
              res.send = (data: any) => { res.end(data); return res; };
              res.writeHead = res.writeHead || ((code: number, headers: any) => {
                res.statusCode = code;
                Object.entries(headers || {}).forEach(([k, v]) => res.setHeader(k, v as string));
                return res;
              });

              if (req.method === 'POST' || req.method === 'PUT') {
                let body = '';
                await new Promise<void>((resolve) => {
                  req.on('data', (chunk: any) => { body += chunk; });
                  req.on('end', () => { resolve(); });
                });
                // Store raw body so handlers with bodyParser:false (e.g. webhook) can read it.
                req._rawBody = body;
                try { req.body = JSON.parse(body); } catch { req.body = body; }
              } else {
                req.body = {};
                req._rawBody = '';
              }

              const queryParams: Record<string, string> = {};
              parsedUrl.searchParams.forEach((val, key) => { queryParams[key] = val; });
              req.query = queryParams;

              await handler(req, res);
            } catch (err: any) {
              console.error(`[Serverless Dev Proxy] Error in ${filePath}:`, err);
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: err.message || 'Internal Server Error' }));
            }
          };

          if (pathName === '/api/abacatepay-checkout') {
            await runServerless('./api/abacatepay-checkout.ts');
          } else if (pathName === '/api/abacatepay-webhook') {
            await runServerless('./api/abacatepay-webhook.ts');
          } else if (pathName === '/api/abacatepay-portal') {
            await runServerless('./api/abacatepay-portal.ts');
          } else if (pathName === '/api/abacatepay-test') {
            await runServerless('./api/abacatepay-test.ts');
          } else if (pathName === '/api/reset-monthly-reports') {
            await runServerless('./api/reset-monthly-reports.ts');
          } else if (pathName === '/api/promote-admin') {
            await runServerless('./api/promote-admin.ts');
          } else if (pathName === '/api/abacatepay-cancel') {
            await runServerless('./api/abacatepay-cancel.ts');
          } else {
            next();
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
        id: '/',
        name: 'LAUD.US — Laudos Inteligentes',
        short_name: 'LAUD.US',
        description: 'Plataforma Inteligente de Laudos Ultrassonográficos com IA',
        theme_color: '#0568c5',
        background_color: '#0a0a0c',
        display: 'standalone',
        display_override: ['standalone', 'minimal-ui'],
        orientation: 'portrait-primary',
        lang: 'pt-BR',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        categories: ['medical', 'productivity', 'health'],
        prefer_related_applications: false,
        icons: [
          { src: '/icons/icon-72x72.png', sizes: '72x72', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-96x96.png', sizes: '96x96', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-128x128.png', sizes: '128x128', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-144x144.png', sizes: '144x144', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-152x152.png', sizes: '152x152', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-384x384.png', sizes: '384x384', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          // Maskable icons — separate entries (combining 'any maskable' causes Android to always crop)
          { src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        screenshots: [
          {
            src: '/icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            form_factor: 'narrow',
            label: 'LAUD.US — Tela inicial'
          },
          {
            src: '/icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            form_factor: 'wide',
            label: 'LAUD.US — Dashboard'
          }
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
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        runtimeCaching: [
          {
            // Google Fonts stylesheets
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] }
            }
          },
          {
            // Google Fonts files (woff2)
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
          },
          {
            // Firebase Auth token endpoints
            urlPattern: /^https:\/\/.*\.googleapis\.com\/identitytoolkit\/.*/i,
            handler: 'NetworkFirst',
            options: { cacheName: 'firebase-auth-cache', networkTimeoutSeconds: 10 }
          },
          {
            // Firebase Storage (images, signatures, etc)
            urlPattern: /^https:\/\/firebasestorage\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'firebase-storage-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] }
            }
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
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Firebase separado (maior vendor)
          'vendor-firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          // React core
          'vendor-react': ['react', 'react-dom'],
          // UI libs
          'vendor-ui': ['framer-motion', 'lucide-react'],
          // Editor Tiptap (ProseMirror = pesado)
          'vendor-editor': [
            '@tiptap/react',
            '@tiptap/starter-kit',
            '@tiptap/extension-text-align',
            '@tiptap/extension-underline',
          ],
          // IA Gemini SDK
          'vendor-ai': ['@google/generative-ai'],
          // Exportação DOCX
          'vendor-export': ['docx', 'file-saver'],
        },
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    host: '0.0.0.0',
    allowedHosts: true,
    open: process.env.RUNNING_IN_DOCKER === 'true' ? false : true,
    proxy: {
      '/api/anthropic': {
        target: 'https://api.anthropic.com',
        changeOrigin: true,
        rewrite: () => '/v1/messages',
        secure: true,
        configure: (proxy: any) => {
          proxy.on('proxyReq', (proxyReq: any, req: any) => {
            const key = req.headers['x-api-key'] || process.env.ANTHROPIC_API_KEY || '';
            if (key) proxyReq.setHeader('x-api-key', key);
          });
        },
      },
      '/api/gemini': {
        target: 'https://generativelanguage.googleapis.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path: string) => {
          // Strip /api/gemini — actual URL is built in configure
          return path.replace('/api/gemini', '');
        },
        configure: (proxy: any, _options: any) => {
          proxy.on('proxyReq', (proxyReq: any, req: any) => {
            const key = req.headers['x-api-key'] || process.env.GOOGLE_API_KEY || '';
            const model = req.headers['x-gemini-model'] || 'gemini-3.5-flash';
            const isStream = req.headers['x-gemini-stream'] === 'true';
            const action = isStream ? 'streamGenerateContent' : 'generateContent';
            const url = `/v1beta/models/${model}:${action}?key=${key}${isStream ? '&alt=sse' : ''}`;
            proxyReq.path = url;
          });
        },
      },
    }
  }
})

