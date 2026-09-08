interface TelegramWebApp {
  initData: string;
  initDataUnsafe?: { start_param?: string };
  ready(): void;
  expand(): void;
  close?(): void;
  openInvoice?(url: string, callback?: (status: string) => void): void;
}

export function closeTelegramMiniApp(): void {
  window.Telegram?.WebApp?.close?.();
}

export async function openTelegramInvoice(url: string): Promise<string> {
  const webApp = window.Telegram?.WebApp;
  if (!webApp?.openInvoice) {
    window.open(url, "_blank", "noopener,noreferrer");
    return "opened";
  }
  return new Promise((resolve) => webApp.openInvoice!(url, resolve));
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

export type LaunchContext = { mode: "telegram"; initData: string } | { mode: "demo" };

export function getTelegramStartParam(locationSearch = window.location.search): string | null {
  return (
    window.Telegram?.WebApp?.initDataUnsafe?.start_param ??
    new URLSearchParams(locationSearch).get("tgWebAppStartParam")
  );
}

export function getLaunchContext(locationSearch = window.location.search): LaunchContext {
  const webApp = window.Telegram?.WebApp;
  if (webApp?.initData) {
    webApp.ready();
    webApp.expand();
    return { mode: "telegram", initData: webApp.initData };
  }

  const demoRequested = new URLSearchParams(locationSearch).get("demo") === "1";
  if (import.meta.env.DEV && demoRequested) return { mode: "demo" };

  const developmentInitData = import.meta.env.VITE_DEMO_INIT_DATA;
  if (import.meta.env.DEV && developmentInitData) {
    return { mode: "telegram", initData: developmentInitData };
  }

  throw new Error("Откройте приложение из Telegram или включите локальный demo-режим.");
}
