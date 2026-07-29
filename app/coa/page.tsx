import Link from "next/link";
import Image from "next/image";
import { PageHero } from "@/components/page-hero";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { christineWhatsapp, publishedCertificates } from "@/lib/content";
import { assetPath } from "@/lib/site-config";

export default function CoaPage(){
  return <><SiteHeader /><main><PageHero title="Third-party COA verification" eyebrow="ORIGINAL REPORT LINKS" />
    <section className="coa-intro"><div className="section-shell"><div><h2>View the actual reports.</h2><p>These published Janoshik report images show the client, manufacturer, batch, measured result and verification key. For another product or the current production batch, message Christine directly.</p></div><a className="primary-button" href={christineWhatsapp} target="_blank" rel="noreferrer">Request another COA</a></div></section>
    <section className="section-pad"><div className="section-shell coa-grid">{publishedCertificates.map(item=><article key={item.slug}>
      <Link className="coa-report-thumb" href={`/coa/${item.slug}`}>
        <Image src={assetPath(item.reportImage!)} alt={`Janoshik test report ${item.reportNumber} for ${item.name}`} fill sizes="(max-width: 700px) 50vw, 25vw" />
        <span>VIEW FULL REPORT</span>
      </Link>
      <span>{item.testType}</span><h2>{item.name}</h2><p>Report #{item.reportNumber} · Key {item.verificationKey}</p><div><Link href={`/coa/${item.slug}`}>View report details</Link><a href={item.reportUrl} target="_blank" rel="noreferrer">Original ↗</a></div>
    </article>)}</div>
    <div className="section-shell coa-contact-banner"><div><span>NEED A DIFFERENT PRODUCT OR BATCH?</span><h2>Ask Christine for the latest report.</h2><p>Send the product name and specification by WhatsApp. We will provide the available current-batch documentation privately.</p></div><a className="primary-button" href={christineWhatsapp} target="_blank" rel="noreferrer">Message Christine →</a></div>
    </section>
  </main><SiteFooter /></>;
}
