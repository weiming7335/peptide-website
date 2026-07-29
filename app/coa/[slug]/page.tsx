import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { certificates, christineWhatsapp } from "@/lib/content";

export function generateStaticParams(){return certificates.map(({slug})=>({slug}));}
export default async function CertificatePage({params}:{params:Promise<{slug:string}>}){
  const {slug}=await params; const item=certificates.find(entry=>entry.slug===slug); if(!item) notFound();
  return <><SiteHeader /><main><section className="certificate-detail section-shell"><div className="certificate-visual"><div>JP</div><span>THIRD-PARTY TEST REPORT</span><strong>{item.testType}</strong><small>Open the original laboratory page to review the complete report.</small></div><aside><p className="eyebrow">COA VERIFICATION</p><h1>{item.name}</h1><dl><div><dt>Test type</dt><dd>{item.testType}</dd></div><div><dt>Source</dt><dd>Janoshik Analytical</dd></div><div><dt>Access</dt><dd>Original verification link</dd></div></dl><a className="primary-button" href={item.reportUrl} target="_blank" rel="noreferrer">Verify original report ↗</a><a className="text-link" href={christineWhatsapp} target="_blank" rel="noreferrer">Request current batch COA</a><p className="legal-note">A report applies only to the sample identified by the testing laboratory. Confirm current batch documentation with our team.</p></aside></section></main><SiteFooter /></>;
}
