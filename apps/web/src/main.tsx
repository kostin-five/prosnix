import { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import "./styles/index.css";
import { LazyBoundary } from "./app/lazy-boundary.js";

const PrivacyPolicy = lazy(() =>
  import("./features/legal/privacy-policy.tsx").then((module) => ({
    default: module.PrivacyPolicy,
  })),
);
const TermsOfUse = lazy(() =>
  import("./features/legal/terms-of-use.tsx").then((module) => ({ default: module.TermsOfUse })),
);
const AdminEntry = lazy(() =>
  import("./features/admin/admin-entry.tsx").then((module) => ({ default: module.AdminEntry })),
);

const telegramStartParam =
  window.Telegram?.WebApp?.initDataUnsafe?.start_param ??
  new URLSearchParams(window.location.search).get("tgWebAppStartParam");

const content =
  window.location.pathname === "/privacy" ? (
    <PrivacyPolicy />
  ) : window.location.pathname === "/terms" ? (
    <TermsOfUse />
  ) : window.location.pathname === "/admin" || telegramStartParam === "admin" ? (
    <AdminEntry />
  ) : (
    <App />
  );

createRoot(document.getElementById("root")!).render(
  <LazyBoundary>
    <Suspense fallback={<main className="min-h-screen bg-[#08080f]" />}>{content}</Suspense>
  </LazyBoundary>,
);
