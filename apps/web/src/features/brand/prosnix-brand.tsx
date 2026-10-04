import { useId } from "react";
import wordmarkUrl from "../../../../../assets/brand/prosnix-ribbon-wordmark-v6.jpg";

export function ProsnixWordmark({ className = "" }: { className?: string }) {
  const filterId = `prosnix-cutout-${useId().replace(/:/g, "")}`;
  return (
    <span className={`ps-brand-wordmark ${className}`} role="img" aria-label="Prosnix">
      <svg width="0" height="0" aria-hidden="true" className="absolute">
        <defs>
          <filter id={filterId} colorInterpolationFilters="sRGB">
            <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  2 2 2 0 -0.4" />
          </filter>
        </defs>
      </svg>
      <img
        src={wordmarkUrl}
        style={{ filter: `url(#${filterId})` }}
        alt=""
        aria-hidden="true"
        width={1774}
        height={887}
        decoding="async"
      />
    </span>
  );
}

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
    <div className="flex min-w-0 items-center gap-2">
      <ProsnixWordmark />
      <ProductBetaBadge />
    </div>
  );
}
