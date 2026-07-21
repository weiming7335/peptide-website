import Image from "next/image";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { certificates, whatsappUrl } from "@/lib/content";

export function generateStaticParams() { return certificates.map(({ slug }) => ({ slug })); }

export default async function CertificatePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params; const item = certificates.find(c => c.slug === slug); if (!item) notFound();
  return <><SiteHeader /><main><section className="certificate-detail section-shell"><div className="certificate-sheet"><Image src={item.image} alt={`${item.name} Certificate of Analysis`} fill priority sizes="(max-width: 800px) 100vw, 60vw" /></div><aside><p className="eyebrow">CERTIFICATE OF ANALYSIS</p><h1>{item.name}</h1><p>Review the available batch documentation. Contact our team to confirm the certificate for your required product and production lot.</p><a className="primary-button" href={whatsappUrl} target="_blank" rel="noreferrer">VERIFY ON WHATSAPP <span>→</span></a></aside></section></main><SiteFooter /></>;
}
