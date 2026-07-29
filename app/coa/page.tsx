import Link from "next/link";
import { PageHero } from "@/components/page-hero";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { certificates, christineWhatsapp } from "@/lib/content";

export default function CoaPage(){
  return <><SiteHeader /><main><PageHero title="Third-party COA verification" eyebrow="ORIGINAL REPORT LINKS" />
    <section className="coa-intro"><div className="section-shell"><div><h2>Verify at the source.</h2><p>Each available entry links to the original Janoshik report page. Match the product, report number and unique verification key before relying on a document.</p></div><a className="primary-button" href={christineWhatsapp} target="_blank" rel="noreferrer">Request current batch COA</a></div></section>
    <section className="section-pad"><div className="section-shell coa-grid">{certificates.map(item=><article key={item.slug}>
      <Link className="coa-paper" href={`/coa/${item.slug}`}>
        <div className="coa-paper-head"><b>JANOSHIK</b><span>ANALYTICAL</span></div>
        <div className="coa-paper-mark">JP</div>
        <dl><div><dt>REPORT</dt><dd>#{item.reportNumber}</dd></div><div><dt>SAMPLE</dt><dd>{item.sampleCode}</dd></div><div><dt>TEST</dt><dd>{item.testType}</dd></div></dl>
        <small>THIRD-PARTY VERIFICATION RECORD</small>
      </Link>
      <span>{item.testType}</span><h2>{item.name}</h2><p>Report #{item.reportNumber} · Key {item.verificationKey}</p><div><Link href={`/coa/${item.slug}`}>View report details</Link><a href={item.reportUrl} target="_blank" rel="noreferrer">Original ↗</a></div>
    </article>)}</div></section>
  </main><SiteFooter /></>;
}
