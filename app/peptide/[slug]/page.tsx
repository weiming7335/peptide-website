import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { christineWhatsapp, products } from "@/lib/content";
import { ProductVisual } from "@/components/product-visual";

export function generateStaticParams(){ return products.map(({slug})=>({slug})); }

export default async function ProductPage({params}:{params:Promise<{slug:string}>}){
  const {slug}=await params; const item=products.find(product=>product.slug===slug); if(!item) notFound();
  const message=encodeURIComponent(`Hi Christine, I’m interested in ${item.name}. Please send me the current price and batch COA.`);
  return <><SiteHeader /><main>
    <section className="product-detail section-shell">
      <div className="detail-art"><ProductVisual item={item} detail /><span>Research Use Only · Not for Human Consumption</span></div>
      <div className="detail-copy"><p className="eyebrow">{item.category}</p><h1>{item.name}</h1><p>Available in sealed research kits with 10 vials per kit. One-kit minimum order with retail, wholesale and custom packaging support.</p>
        <div className="spec-table">{item.specs.map((spec,index)=><div key={spec}><span>{item.codes[index] ?? item.codes[0]}</span><strong>{spec}</strong><b>10 vials / kit</b></div>)}</div>
        <div className="button-row"><a className="primary-button" href={`${christineWhatsapp}?text=${message}`} target="_blank" rel="noreferrer">Get current price</a><Link className="secondary-button" href="/coa">Check available COA</Link></div>
      </div>
    </section>
    <section className="detail-info section-pad"><div className="section-shell info-grid"><article><span>01</span><h2>Batch documentation</h2><p>Ask for current batch-linked third-party documentation before ordering.</p></article><article><span>02</span><h2>Worldwide delivery</h2><p>USPS and FedEx options for the United States, with international fulfillment support.</p></article><article><span>03</span><h2>Custom presentation</h2><p>Label and packaging customization is normally completed in 1–2 weeks.</p></article></div></section>
  </main><SiteFooter /></>;
}
