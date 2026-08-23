import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="site-header shell">
      <Link className="brand" href="/" aria-label="Still, inicio">
        <span className="brand-mark">⌁</span>
        <span>still</span>
      </Link>
      <nav aria-label="Principal">
        <Link href="/impact">Impacto</Link>
        <Link className="nav-cta" href="/#download">Probar la app</Link>
      </nav>
    </header>
  );
}
