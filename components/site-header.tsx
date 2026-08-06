import Image from "next/image";
import Link from "next/link";
import { navigation } from "@/lib/site";

export function SiteHeader() {
  return <header className="site-header">
    <div className="shell header-inner">
      <Link className="brand" href="/" aria-label="Jike Peptide home">
        <Image src="/brand/jike-logo.png" alt="Jike Peptide" width={214} height={75} priority />
      </Link>
      <nav className="desktop-nav" aria-label="Main navigation">
        {navigation.map((item) => <Link href={item.href} key={item.href}>{item.label}</Link>)}
      </nav>
      <Link className="button button-small header-quote" href="/request-a-quote">Request a Quote</Link>
      <details className="mobile-menu">
        <summary aria-label="Open navigation"><span></span><span></span><span></span></summary>
        <nav>
          {navigation.map((item) => <Link href={item.href} key={item.href}>{item.label}</Link>)}
          <Link className="button" href="/request-a-quote">Request a Quote</Link>
        </nav>
      </details>
    </div>
  </header>;
}
