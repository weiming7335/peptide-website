import Image from "next/image";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { products, whatsappUrl } from "@/lib/content";

export function generateStaticParams() { return products.map(({ slug }) => ({ slug })); }

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = products.find(item => item.slug === slug);
  if (!product) notFound();
  return <><SiteHeader /><main><section className="product-detail section-shell"><div className="detail-image"><Image src={product.image} alt={product.name} fill priority sizes="(max-width: 800px) 100vw, 50vw" /></div><div className="detail-copy"><span className="detail-category">PEPTIDE</span><h1>{product.name}</h1><p>{product.summary}</p><ul><li>High-purity research grade supply</li><li>Batch-level quality documentation</li><li>Custom and bulk order support</li><li>Worldwide tracked delivery</li></ul><a className="primary-button" href={whatsappUrl} target="_blank" rel="noreferrer">QUOTE ON WHATSAPP <span>→</span></a><div className="detail-meta"><b>Category:</b> Peptide<br/><b>Use:</b> Laboratory research only</div></div></section><section className="detail-description"><div className="section-shell"><h2>Description</h2><p>{product.name} is available to qualified research and B2B customers. Contact Leaxion with the required specification, quantity and destination to receive current documentation and a tailored quotation.</p></div></section></main><SiteFooter /></>;
}
