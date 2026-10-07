import { BarChart2, Home, Settings } from "lucide-react";

export function BottomNav({
  current,
  onTab,
}: {
  current: "home" | "stats" | "settings";
  onTab: (t: "home" | "stats" | "settings") => void;
}) {
  return (
    <div className="ps-bottom-nav fixed bottom-0 left-1/2 z-50 flex w-full max-w-[390px] -translate-x-1/2 items-center justify-around px-5 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3">
      {[
        { key: "home" as const, icon: <Home className="w-5 h-5" />, label: "Главная" },
        { key: "stats" as const, icon: <BarChart2 className="w-5 h-5" />, label: "Статистика" },
        { key: "settings" as const, icon: <Settings className="w-5 h-5" />, label: "Настройки" },
      ].map((tab) => (
        <button
          key={tab.key}
          aria-current={current === tab.key ? "page" : undefined}
          onClick={() => onTab(tab.key)}
          className={`flex min-h-14 flex-col items-center gap-1 rounded-xl px-4 py-2 transition-colors ${current === tab.key ? "text-amber-400" : "text-muted-foreground"}`}
        >
          {tab.icon}
          <span className="text-xs font-medium">{tab.label}</span>
        </button>
      ))}
    </div>
  );
}
