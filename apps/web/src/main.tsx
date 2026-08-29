import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import { PrivacyPolicy } from "./features/legal/privacy-policy.tsx";
import "./styles/index.css";

const content = window.location.pathname === "/privacy" ? <PrivacyPolicy /> : <App />;

createRoot(document.getElementById("root")!).render(content);
