/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEMO_INIT_DATA?: string;
  readonly VITE_GOAL_CALIBRATION_ENABLED?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
