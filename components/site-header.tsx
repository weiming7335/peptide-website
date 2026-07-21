"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { whatsappUrl } from "@/lib/content";

export function SiteHeader() {
  const pathname = usePathname();
  const navigation = [
    ["Home", "/"], ["Peptide", "/peptide"], ["COA", "/coa"],
    ["Blog", "/blog"], ["About us", "/about"], ["Contact US", "/contact"],
  ];
  const isActive = (href: string) => href === "/" ? pathname === "/" : pathname.startsWith(href);

  return <>
    <div className="announcement"><span>What Is Peptide Purity and Why Does It Matter in Research-Grade Peptides?</span><span>How to Verify Leaxion Official Business Contacts</span></div>
    <header className="site-header"><div className="nav-shell">
      <Link className="brand" href="/"><Image src="/images/logo/logo-leaxionpng.png" alt="Leaxion" width={230} height={92} priority /></Link>
      <nav aria-label="Main navigation">{navigation.map(([label, href]) => <Link className={isActive(href) ? "active" : undefined} href={href} key={href}>{label}</Link>)}</nav>
      <details className="mobile-menu"><summary aria-label="Open navigation">Menu</summary><div>{navigation.map(([label, href]) => <Link className={isActive(href) ? "active" : undefined} href={href} key={href}>{label}</Link>)}<Link className={isActive("/faq") ? "active" : undefined} href="/faq">F.A.Q.</Link></div></details>
      <a className="quote-button" href={whatsappUrl} target="_blank" rel="noreferrer">Quote Now <span>→</span></a>
    </div></header>
  </>;
}
