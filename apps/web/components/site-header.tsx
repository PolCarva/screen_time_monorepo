import Link from "next/link";
import { AndroidDownloadLink } from "@/components/android-download-link";
import { BrandLockup } from "@/components/brand-mark";

export function SiteHeader() {
  return (
    <header className="site-header shell-wide">
      <BrandLockup />
      <nav aria-label="Principal">
        <Link className="nav-link" href="/#producto">Producto</Link>
        <Link className="nav-link" href="/impact">Impacto</Link>
        <AndroidDownloadLink className="button button--small button--outline">
          Descargar APK
        </AndroidDownloadLink>
      </nav>
    </header>
  );
}
