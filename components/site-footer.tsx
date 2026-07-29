import Image from "next/image";
import Link from "next/link";
import { assetPath, companyName } from "@/lib/site-config";
import { christineWhatsapp, email, lunaWhatsapp, whatsappChannel } from "@/lib/content";
import { WhatsAppIcon } from "@/components/whatsapp-icon";

export function SiteFooter() {
  return <footer>
    <div className="section-shell footer-grid">
      <div className="footer-brand"><Image src={assetPath("/images/jike/logo-blue-jp.jpg")} alt="JP" width={82} height={82} /><h3>Jike Peptide</h3><p>The international business team of JikeBioTech, serving research customers worldwide.</p></div>
      <div><h3>Explore</h3><Link href="/peptide">Product catalog</Link><Link href="/coa">COA verification</Link><Link href="/about">Company</Link><Link href="/faq">FAQ</Link></div>
      <div><h3>Contact</h3><a href={christineWhatsapp} target="_blank" rel="noreferrer">Christine · WhatsApp</a><a href={lunaWhatsapp} target="_blank" rel="noreferrer">Luna · WhatsApp</a><a href={`mailto:${email}`}>{email}</a><a href={whatsappChannel} target="_blank" rel="noreferrer">WhatsApp Channel</a></div>
      <div><h3>Important notice</h3><p>Products are supplied strictly for laboratory research and analytical use. Not for human consumption.</p><Link href="/privacy-policy">Privacy policy</Link></div>
    </div>
    <div className="section-shell copyright"><span>© 2026 {companyName}</span><span>Jike Peptide Team · Guangzhou, China</span></div>
    <a className="floating-contact" href={christineWhatsapp} target="_blank" rel="noreferrer" aria-label="Chat with Christine on WhatsApp"><WhatsAppIcon /></a>
  </footer>;
}
