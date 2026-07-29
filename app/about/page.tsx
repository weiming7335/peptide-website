import Image from "next/image";
import { PageHero } from "@/components/page-hero";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { assetPath } from "@/lib/site-config";
import { christineWhatsapp } from "@/lib/content";

export default function AboutPage(){
  return <><SiteHeader /><main><PageHero title="The international team behind JP" eyebrow="JIKE PEPTIDE TEAM" />
    <section className="section-pad"><div className="section-shell about-lead"><div><p className="eyebrow">ABOUT US</p><h2>Part of JikeBioTech. Focused on international customers.</h2></div><div><p>Jike Peptide Team is the international business team of JikeBioTech, operated by Jike Biotech (Guangzhou) Co., Ltd.</p><p>We support research customers with catalog supply, batch documentation, order coordination, worldwide delivery and custom packaging.</p></div></div></section>
    <section className="video-section"><div className="section-shell video-grid"><div><video controls playsInline preload="metadata" poster={assetPath("/images/real/inventory.jpg")}><source src={assetPath("/video/factory.mp4")} type="video/mp4"/></video><span>JikeBioTech company overview</span></div><div><video controls muted playsInline preload="metadata"><source src={assetPath("/video/filling-line.mp4")} type="video/mp4"/></video><span>Production line footage</span></div></div></section>
    <section className="section-pad"><div className="section-shell proof-gallery"><figure className="wide"><Image src={assetPath("/images/real/ready-stock.jpg")} alt="Ready stock research kits" fill sizes="60vw"/><figcaption>Ready stock across multiple specifications</figcaption></figure><figure><Image src={assetPath("/images/real/ghk-cu-50.jpg")} alt="GHK-CU research kit" fill sizes="40vw"/><figcaption>10-vial kit presentation</figcaption></figure><figure><Image src={assetPath("/images/real/order-sorting.jpg")} alt="Order sorting" fill sizes="40vw"/><figcaption>Order sorting and preparation</figcaption></figure></div></section>
    <section className="custom-callout"><div className="section-shell"><div><p className="eyebrow">OEM / PRIVATE LABEL</p><h2>Custom labels and packaging in 1–2 weeks.</h2><p>MOQ depends on the selected product, label and packaging requirements.</p></div><a className="light-button" href={christineWhatsapp} target="_blank" rel="noreferrer">Discuss your project →</a></div></section>
  </main><SiteFooter /></>;
}
