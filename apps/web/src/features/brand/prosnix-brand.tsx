export function ProductBetaBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border border-accent/25 bg-accent/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-accent ${className}`}
    >
      Beta
    </span>
  );
}

export function ProsnixBrand() {
  return (
    <div className="min-w-0" aria-label="Prosnix Beta">
      <div className="flex items-center gap-2.5">
        <svg aria-hidden="true" className="h-9 w-9 shrink-0" viewBox="0 0 44 44" fill="none">
          <defs>
            <linearGradient id="prosnix-mark" x1="8" y1="37" x2="37" y2="7">
              <stop stopColor="#ff7a00" />
              <stop offset="1" stopColor="#facc15" />
            </linearGradient>
          </defs>
          <path
            d="M10 36 17 9h10.5c6 0 9.5 3.5 9.5 8.7 0 5.7-4.3 9.3-10.7 9.3h-7.4L16.5 36H10Z"
            stroke="url(#prosnix-mark)"
            strokeWidth="4.5"
            strokeLinejoin="round"
          />
          <path d="M20 21h12" stroke="url(#prosnix-mark)" strokeWidth="4.5" />
          <path d="M20 17a7 7 0 0 1 12 0" fill="#facc15" fillOpacity=".28" />
        </svg>
        <div className="flex min-w-0 items-center gap-2">
          <h1 className="truncate text-[1.35rem] font-black leading-none tracking-[0.08em]">
            PROSNI<span className="text-primary">X</span>
          </h1>
          <ProductBetaBadge />
        </div>
      </div>
    </div>
  );
}
