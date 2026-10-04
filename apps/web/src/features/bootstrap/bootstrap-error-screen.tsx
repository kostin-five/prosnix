import { ProsnixWordmark } from "../brand/prosnix-brand.js";
import { AlertCircle } from "lucide-react";

export function BootstrapErrorScreen({
  timedOut,
  message,
  onRetry,
}: {
  timedOut: boolean;
  message: string;
  onRetry: () => void;
}) {
  return (
    <div
      role="alert"
      className="ps-start min-h-screen text-foreground flex items-center justify-center p-6"
    >
      <div className="w-full max-w-sm text-center">
        <ProsnixWordmark className="mb-14" />
        <div className="ps-surface p-6">
          <AlertCircle className="w-10 h-10 text-amber-400 mx-auto mb-5" />
          <h1 className="ps-flow-title text-2xl">
            {timedOut ? "Сервер ещё запускается" : "Не удалось безопасно войти"}
          </h1>
          <p className="text-sm text-muted-foreground mt-2">{message}</p>
          <a
            href="/privacy"
            className="mt-4 block text-sm text-muted-foreground underline underline-offset-4"
          >
            Политика конфиденциальности
          </a>
          <button onClick={onRetry} className="ps-primary-button mt-6 w-full">
            Повторить
          </button>
        </div>
      </div>
    </div>
  );
}

export default BootstrapErrorScreen;
