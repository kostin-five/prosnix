function PixAvatar() {
  return (
    <svg
      viewBox="0 0 64 64"
      className="h-14 w-14 shrink-0"
      aria-hidden="true"
      data-testid="pix-avatar"
    >
      <path
        d="M11 24 16 7l14 11M53 24 48 7 34 18"
        fill="#fb923c"
        stroke="#111827"
        strokeWidth="3"
      />
      <path
        d="M16 22c5-8 27-8 32 0 7 12 1 31-16 31S9 34 16 22Z"
        fill="#fb923c"
        stroke="#111827"
        strokeWidth="3"
      />
      <path d="M18 35c7 2 7 13 14 13s7-11 14-13c-2 11-7 18-14 18s-12-7-14-18Z" fill="#ffedd5" />
      <circle cx="24" cy="31" r="2.5" fill="#111827" />
      <circle cx="40" cy="31" r="2.5" fill="#111827" />
      <path
        d="m28 39 4 3 4-3"
        fill="none"
        stroke="#111827"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.5"
      />
      <path
        d="M29 14c1-5 5-5 6 0"
        fill="none"
        stroke="#facc15"
        strokeLinecap="round"
        strokeWidth="3"
      />
    </svg>
  );
}

export function PixGuide({ variant }: { variant: "onboarding" | "reward" }) {
  return (
    <aside className="flex items-center gap-3 rounded-2xl border border-primary/20 bg-primary/8 p-3">
      <PixAvatar />
      <div>
        <p className="text-xs font-bold text-primary">Пикс</p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
          {variant === "onboarding"
            ? "Поможет настроить безопасное пробуждение без лишних решений утром."
            : "Готово. Результат сохранён — теперь можно спокойно оценить эффект."}
        </p>
      </div>
    </aside>
  );
}

export default PixGuide;
