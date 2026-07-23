/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />
/// <reference types="vite-plugin-pwa/client" />

// Injetados pelo `define` do Vite (ver vite.config.ts).
declare const __APP_VERSION__: string;
declare const __BUILD_ID__: string;

interface Window {
  gapi: any;
  google: any;
}
