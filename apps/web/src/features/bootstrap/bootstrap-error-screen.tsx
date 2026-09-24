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
      className="min-h-screen bg-background text-foreground flex items-center justify-center p-6"
    >
      <div className="max-w-sm text-center">
        <AlertCircle className="w-10 h-10 text-primary mx-auto mb-4" />
        <h1 className="text-xl font-bold">
          {timedOut ? "Сервер ещё запускается" : "Не удалось безопасно войти"}
        </h1>
        <p className="text-sm text-muted-foreground mt-2">{message}</p>
        <a
          href="/privacy"
          className="mt-4 block text-sm text-muted-foreground underline underline-offset-4"
        >
          Политика конфиденциальности
        </a>
        <button
          onClick={onRetry}
          className="mt-6 w-full rounded-2xl bg-primary py-3 font-bold text-white"
        >
          Повторить
        </button>
      </div>
    </div>
  );
}

export default BootstrapErrorScreen;
