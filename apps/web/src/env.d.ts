/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEMO_INIT_DATA?: string;
  readonly VITE_GOAL_CALIBRATION_ENABLED?: string;
  readonly VITE_GUIDED_TASK_EXPERIENCE_ENABLED?: string;
  readonly VITE_WAKE_TASK_CATALOG_V9_ENABLED?: string;
  readonly VITE_WAKE_TASK_SUBSTITUTION_ENABLED?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
