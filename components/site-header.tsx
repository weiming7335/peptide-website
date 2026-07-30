"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { assetPath } from "@/lib/site-config";
import { christineWhatsapp } from "@/lib/content";

export function SiteHeader() {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const navProps = (href: string) => {
    const active = pathname === href || pathname.startsWith(`${href}/`);
    return { className: active ? "active" : undefined, "aria-current": active ? "page" as const : undefined };
  };

  return <>
    <header className={`site-header${isHome ? " home-header" : ""}`}>
      <div className="section-shell nav-shell">
        <Link className="brand" href="/" aria-label="Jike Peptide home">
          <Image src={assetPath("/images/jike/logo-blue-jp-transparent.png")} alt="JP" width={92} height={55} priority />
          <span><strong>Jike Peptide</strong><small>INTERNATIONAL RESEARCH SUPPLY</small></span>
        </Link>
        <nav>
          <Link href="/peptide" {...navProps("/peptide")}>Products</Link>
          <Link href="/coa" {...navProps("/coa")}>COA Verification</Link>
          <Link href="/faq" {...navProps("/faq")}>FAQ</Link>
          <Link href="/contact" {...navProps("/contact")}>Contact</Link>
        </nav>
        <details className="mobile-menu"><summary>Menu</summary><div><Link href="/peptide" {...navProps("/peptide")}>Products</Link><Link href="/coa" {...navProps("/coa")}>COA</Link><Link href="/faq" {...navProps("/faq")}>FAQ</Link><Link href="/contact" {...navProps("/contact")}>Contact</Link></div></details>
        <a className="header-cta" href={christineWhatsapp} target="_blank" rel="noreferrer">Request a quote</a>
      </div>
    </header>
  </>;
}
