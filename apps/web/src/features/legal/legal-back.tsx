import { ArrowLeft } from "lucide-react";

export function LegalBack() {
  const goBack = () => {
    if (window.history.length > 1) window.history.back();
    else window.location.assign("/");
  };
  return (
    <button
      type="button"
      onClick={goBack}
      className="mb-6 inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-3 text-sm font-semibold"
    >
      <ArrowLeft className="h-4 w-4" /> Назад в приложение
    </button>
  );
}
