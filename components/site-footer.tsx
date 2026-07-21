import Image from "next/image";
import Link from "next/link";
import { whatsappUrl } from "@/lib/content";
import { WhatsAppIcon } from "@/components/whatsapp-icon";
import { assetPath } from "@/lib/site-config";

export function SiteFooter() {
  return <>
    <footer><div className="section-shell footer-grid"><div className="footer-brand"><Image src={assetPath("/images/logo/logo-leaxionpng.png")} alt="Leaxion" width={220} height={88} /><p>High-Purity Peptides Manufacturer | 7+ Years</p></div><div><h3>Company</h3><Link href="/">Home</Link><Link href="/about">About Us</Link><Link href="/contact">Contact Us</Link><Link href="/faq">F.A.Q.</Link></div><div><h3>Products</h3><Link href="/peptide">All Products</Link><Link href="/peptide">Research Peptides</Link><Link href="/coa">Certificates</Link><a href={whatsappUrl} target="_blank" rel="noreferrer">Custom Peptides</a></div><div><h3>Connect Us</h3><a href={whatsappUrl} target="_blank" rel="noreferrer">WhatsApp: +852 9841 7612</a><a href={whatsappUrl} target="_blank" rel="noreferrer">Request a Quote</a><Link href="/privacy-policy">Privacy Policy</Link></div></div><div className="copyright section-shell"><span>© 2026 Leaxion. All Rights Reserved.</span><span>RESEARCH USE ONLY</span></div></footer>
    <a className="floating-contact whatsapp" href={whatsappUrl} target="_blank" rel="noreferrer" aria-label="Contact Leaxion on WhatsApp"><WhatsAppIcon /></a>
  </>;
}
