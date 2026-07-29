import Link from "next/link";
import { PageHero } from "@/components/page-hero";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { certificates, christineWhatsapp } from "@/lib/content";

export default function CoaPage(){
  return <><SiteHeader /><main><PageHero title="Third-party COA verification" eyebrow="ORIGINAL REPORT LINKS" />
    <section className="coa-intro"><div className="section-shell"><div><h2>Verify at the source.</h2><p>Each available entry links to the original Janoshik report page. Match the product, report number and unique verification key before relying on a document.</p></div><a className="primary-button" href={christineWhatsapp} target="_blank" rel="noreferrer">Request current batch COA</a></div></section>
    <section className="section-pad"><div className="section-shell coa-grid">{certificates.map(item=><article key={item.slug}><div className="coa-icon">JP<span>COA</span></div><span>{item.testType}</span><h2>{item.name}</h2><p>Independent report link provided for direct verification.</p><div><Link href={`/coa/${item.slug}`}>Details</Link><a href={item.reportUrl} target="_blank" rel="noreferrer">Verify ↗</a></div></article>)}</div></section>
  </main><SiteFooter /></>;
}
