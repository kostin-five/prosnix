import { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import "./styles/index.css";

const PrivacyPolicy = lazy(() =>
  import("./features/legal/privacy-policy.tsx").then((module) => ({
    default: module.PrivacyPolicy,
  })),
);
const TermsOfUse = lazy(() =>
  import("./features/legal/terms-of-use.tsx").then((module) => ({ default: module.TermsOfUse })),
);
const AdminScreen = lazy(() =>
  import("./features/admin/admin-screen.tsx").then((module) => ({ default: module.AdminScreen })),
);

const content =
  window.location.pathname === "/privacy" ? (
    <PrivacyPolicy />
  ) : window.location.pathname === "/terms" ? (
    <TermsOfUse />
  ) : window.location.pathname === "/admin" ? (
    <AdminScreen />
  ) : (
    <App />
  );

createRoot(document.getElementById("root")!).render(
  <Suspense fallback={<main className="min-h-screen bg-[#08080f]" />}>{content}</Suspense>,
);
