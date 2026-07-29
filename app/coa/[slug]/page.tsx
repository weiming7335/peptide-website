import { notFound } from "next/navigation";
import Image from "next/image";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { certificates, christineWhatsapp } from "@/lib/content";
import { assetPath } from "@/lib/site-config";

export function generateStaticParams(){return certificates.map(({slug})=>({slug}));}
export default async function CertificatePage({params}:{params:Promise<{slug:string}>}){
  const {slug}=await params; const item=certificates.find(entry=>entry.slug===slug); if(!item) notFound();
  return <><SiteHeader /><main><section className="certificate-detail section-shell">
    {item.reportImage ? <a className="report-image-wrap" href={item.reportUrl} target="_blank" rel="noreferrer"><Image src={assetPath(item.reportImage)} alt={`Complete Janoshik test report ${item.reportNumber} for ${item.name}`} width={1300} height={2048} priority /><span>Click the report to verify at Janoshik ↗</span></a> : <div className="report-request-placeholder"><span>REPORT AVAILABLE ON REQUEST</span><h2>{item.name}</h2><p>Message Christine for current-batch documentation.</p><a className="primary-button" href={christineWhatsapp} target="_blank" rel="noreferrer">Request via WhatsApp</a></div>}
    <aside><p className="eyebrow">PUBLISHED TEST REPORT</p><h1>{item.name}</h1><dl><div><dt>Test type</dt><dd>{item.testType}</dd></div><div><dt>Report</dt><dd>#{item.reportNumber}</dd></div><div><dt>Sample code</dt><dd>{item.sampleCode}</dd></div><div><dt>Verification key</dt><dd>{item.verificationKey}</dd></div><div><dt>Source</dt><dd>Janoshik Analytical</dd></div></dl><a className="primary-button" href={item.reportUrl} target="_blank" rel="noreferrer">Verify at Janoshik ↗</a><a className="text-link" href={christineWhatsapp} target="_blank" rel="noreferrer">Request another or current-batch COA</a><p className="legal-note">The complete supplied report image is shown on this page. A report applies only to the sample and batch identified in that document. Confirm current-batch documentation before ordering.</p></aside>
  </section></main><SiteFooter /></>;
}
