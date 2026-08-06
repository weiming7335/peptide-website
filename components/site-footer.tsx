import Image from "next/image";
import Link from "next/link";
import { christineWhatsapp, companyName, email, lunaWhatsapp, navigation, whatsappChannel } from "@/lib/site";

export function SiteFooter() {
  return <footer className="site-footer">
    <div className="shell footer-grid">
      <div className="footer-brand">
        <Image src="/brand/jike-logo.png" alt="Jike Peptide" width={230} height={81} />
        <p>You focus on sales. We support the rest.</p>
      </div>
      <div>
        <h2>Explore</h2>
        {navigation.slice(1).map((item) => <Link href={item.href} key={item.href}>{item.label}</Link>)}
        <Link href="/request-a-quote">Request a Quote</Link>
      </div>
      <div>
        <h2>Direct contact</h2>
        <a href={christineWhatsapp} target="_blank" rel="noreferrer">Christine · WhatsApp</a>
        <a href={lunaWhatsapp} target="_blank" rel="noreferrer">Luna · WhatsApp</a>
        <a href={`mailto:${email}`}>{email}</a>
        <a href={whatsappChannel} target="_blank" rel="noreferrer">WhatsApp Channel</a>
      </div>
      <div>
        <h2>Company</h2>
        <p>{companyName}</p>
        <p>Guangzhou, China</p>
        <div className="footer-legal-links"><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link></div>
      </div>
    </div>
    <div className="shell footer-bottom">
      <p>Catalog materials are supplied for laboratory research use only and are not for human consumption.</p>
      <p>International fulfillment is subject to buyer qualification, destination requirements and applicable law.</p>
      <span>© 2026 {companyName}</span>
    </div>
  </footer>;
}
