import bannerUrl from "../../../../../assets/brand/prosnix-telegram-banner-600x320.png";

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
      <div className="flex min-w-0 items-center gap-1.5">
        <h1 aria-label="Prosnix" className="shrink-0">
          <img
            src={bannerUrl}
            alt=""
            aria-hidden="true"
            className="h-11 w-[154px] object-cover object-center"
            style={{
              maskImage: "radial-gradient(ellipse 72% 65% at center,black 58%,transparent 100%)",
              WebkitMaskImage:
                "radial-gradient(ellipse 72% 65% at center,black 58%,transparent 100%)",
            }}
          />
        </h1>
        <ProductBetaBadge className="-ml-1" />
      </div>
    </div>
  );
}
