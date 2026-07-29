import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { certificates, christineWhatsapp } from "@/lib/content";

export function generateStaticParams(){return certificates.map(({slug})=>({slug}));}
export default async function CertificatePage({params}:{params:Promise<{slug:string}>}){
  const {slug}=await params; const item=certificates.find(entry=>entry.slug===slug); if(!item) notFound();
  return <><SiteHeader /><main><section className="certificate-detail section-shell">
    <div className="certificate-visual">
      <header><div><b>JANOSHIK</b><span>ANALYTICAL</span></div><em>REPORT #{item.reportNumber}</em></header>
      <div className="certificate-title"><small>THIRD-PARTY TEST RECORD</small><h2>{item.testType}</h2><p>{item.name}</p></div>
      <dl><div><dt>Sample identification</dt><dd>{item.sampleCode}</dd></div><div><dt>Analysis requested</dt><dd>{item.testType}</dd></div><div><dt>Report number</dt><dd>{item.reportNumber}</dd></div><div><dt>Verification key</dt><dd>{item.verificationKey}</dd></div><div><dt>Laboratory source</dt><dd>Janoshik Analytical</dd></div></dl>
      <footer><b>JP</b><span>Verify the full analytical result at the original laboratory URL.</span></footer>
    </div>
    <aside><p className="eyebrow">COA VERIFICATION</p><h1>{item.name}</h1><dl><div><dt>Test type</dt><dd>{item.testType}</dd></div><div><dt>Report</dt><dd>#{item.reportNumber}</dd></div><div><dt>Sample code</dt><dd>{item.sampleCode}</dd></div><div><dt>Verification key</dt><dd>{item.verificationKey}</dd></div><div><dt>Source</dt><dd>Janoshik Analytical</dd></div></dl><a className="primary-button" href={item.reportUrl} target="_blank" rel="noreferrer">Open complete original report ↗</a><a className="text-link" href={christineWhatsapp} target="_blank" rel="noreferrer">Request current batch COA</a><p className="legal-note">This page reproduces the identifying data encoded in the supplied laboratory URL. Analytical values remain on the original laboratory report. A report applies only to its identified sample; confirm current batch documentation before ordering.</p></aside>
  </section></main><SiteFooter /></>;
}
