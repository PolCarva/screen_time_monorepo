import Link from "next/link";

import { BrandLockup } from "@/components/brand-mark";

export function SiteHeader() {
  return (
    <header className="site-header shell-wide">
      <BrandLockup />
      <nav aria-label="Principal">
        <Link className="nav-link" href="/impact">Registro de impacto</Link>
        <Link className="button button--small button--outline" href="/#beta-status">Estado de la beta</Link>
      </nav>
    </header>
  );
}
