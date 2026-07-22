import Image from "next/image";
import { PageHero } from "@/components/page-hero";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { whatsappUrl } from "@/lib/content";
import { assetPath } from "@/lib/site-config";

export default function ContactPage() {
  return <><SiteHeader /><main><PageHero title="Contact US" /><section className="contact-page section-pad"><div className="section-shell"><div className="contact-image"><Image src={assetPath("/images/contact.webp")} alt="Contact Leaxion" fill sizes="45vw" /></div><div><p className="eyebrow">CONTACT OUR TEAM</p><h1>Secure Your Premium Peptides – Connect with Our Expert Team Today!</h1><p>For products, documentation, quantities and delivery questions, speak directly with our B2B sales team.</p><span>WHATSAPP</span><a className="contact-number" href={whatsappUrl} target="_blank" rel="noreferrer">+1 213 703 8679</a><a className="primary-button" href={whatsappUrl} target="_blank" rel="noreferrer">SEND A MESSAGE <b>→</b></a></div></div></section></main><SiteFooter /></>;
}
