/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEMO_INIT_DATA?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
