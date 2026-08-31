interface TelegramWebApp {
  initData: string;
  ready(): void;
  expand(): void;
  openInvoice?(url: string, callback?: (status: string) => void): void;
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
