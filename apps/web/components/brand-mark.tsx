import Link from "next/link";

type BrandMarkProps = {
  className?: string;
  decorative?: boolean;
};

export function BrandMark({ className, decorative = true }: BrandMarkProps) {
  return (
    <svg
      aria-hidden={decorative}
      aria-label={decorative ? undefined : "Still"}
      className={className}
      role={decorative ? undefined : "img"}
      viewBox="0 0 120 120"
    >
      <g
        fill="none"
        stroke="currentColor"
        strokeLinecap="square"
        strokeLinejoin="round"
        strokeWidth="14"
      >
        <path d="M94 24H45C28 24 20 32 20 43C20 54 29 60 45 60H50" />
        <path d="M70 60H76C92 60 100 66 100 77C100 88 92 96 75 96H26" />
      </g>
    </svg>
  );
}

export function BrandLockup({ href = "/" }: { href?: string }) {
  return (
    <Link className="brand-lockup" href={href} aria-label="Still, inicio">
      <BrandMark className="brand-lockup__mark" />
      <span className="brand-lockup__word">
        still<span aria-hidden="true">.</span>
      </span>
    </Link>
  );
}
