import Link from "next/link";

type BrandMarkProps = { className?: string; decorative?: boolean };

export function BrandMark({ className, decorative = true }: BrandMarkProps) {
  return (
    <svg aria-hidden={decorative} aria-label={decorative ? undefined : "Still"} className={className} role={decorative ? undefined : "img"} viewBox="0 0 120 100">
      <rect className="mark-module mark-module--ink" x="4" y="4" width="44" height="18.5" rx="3.8" />
      <rect className="mark-module mark-module--ink" x="60" y="4" width="44" height="18.5" rx="3.8" />
      <rect className="mark-module mark-module--mineral" x="0" y="35.5" width="44" height="18.5" rx="3.8" />
      <rect className="mark-module mark-module--peach" x="71" y="35.5" width="44" height="18.5" rx="3.8" />
      <rect className="mark-module mark-module--ink" x="4" y="67" width="44" height="18.5" rx="3.8" />
      <rect className="mark-module mark-module--ink" x="60" y="67" width="44" height="18.5" rx="3.8" />
    </svg>
  );
}

export function BrandLockup({ href = "/" }: { href?: string }) {
  return (
    <Link className="brand-lockup" href={href} aria-label="Still, inicio">
      <BrandMark className="brand-lockup__mark" />
      <span className="brand-lockup__word">Still</span>
    </Link>
  );
}
