import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { certificates, christineWhatsapp, products, startingPrices } from "@/lib/content";
import { ProductVisual } from "@/components/product-visual";
import { productKnowledge } from "@/lib/product-knowledge";
import { assetPath } from "@/lib/site-config";

export function generateStaticParams(){ return products.map(({slug})=>({slug})); }

export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{
  const {slug}=await params;
  const item=products.find(product=>product.slug===slug);
  if(!item) return {};
  const knowledge=productKnowledge[slug];
  return {
    title: `${item.name} Research Peptide`,
    description: knowledge?.shortDescription ?? `${item.name} research kits with current specifications and batch documentation from Jike Peptide.`,
  };
}

export default async function ProductPage({params}:{params:Promise<{slug:string}>}){
  const {slug}=await params; const item=products.find(product=>product.slug===slug); if(!item) notFound();
  const message=encodeURIComponent(`Hi Christine, I’m interested in ${item.name}. Please send me the current price and batch COA.`);
  const knowledge=productKnowledge[slug];
  const productCertificates=certificates.filter(certificate=>item.codes.some(code=>certificate.sampleCode.toLowerCase().startsWith(code.replace(/[^a-z0-9]/gi,"").toLowerCase())) || (slug==="mots-c" && certificate.sampleCode==="MOTS40"));
  const related=products.filter(product=>product.slug!==slug && product.category===item.category).slice(0,3);
  const startingPrice=startingPrices[slug];
  return <><SiteHeader /><main>
    <section className="product-detail section-shell">
      <div className="detail-art"><ProductVisual item={item} detail /><span>Research Use Only · Not for Human Consumption</span></div>
      <div className="detail-copy"><p className="eyebrow">{item.category}</p><h1>{item.name}</h1>
        {knowledge && <p className="product-full-name">{knowledge.fullName}</p>}
        <p>{knowledge?.shortDescription ?? "Available in sealed research kits with 10 vials per kit. One-kit minimum order with retail, wholesale and custom packaging support."}</p>
        <div className="procurement-facts">
          <div><span>STARTING AT</span><strong>{startingPrice ? `$${startingPrice}` : "ASK"}</strong><small>per 10-vial kit</small></div>
          <div><span>MOQ</span><strong>1 KIT</strong><small>retail & wholesale</small></div>
          <div><span>DOCUMENTATION</span><strong>{productCertificates.length ? `${productCertificates.length} REPORTS` : "ON REQUEST"}</strong><small>confirm current batch</small></div>
        </div>
        <div className="spec-table">{item.specs.map((spec,index)=><div key={spec}><span>{item.codes[index] ?? item.codes[0]}</span><strong>{spec}</strong><b>10 vials / kit</b></div>)}</div>
        <div className="button-row"><a className="primary-button" href={`${christineWhatsapp}?text=${message}`} target="_blank" rel="noreferrer">Get current price</a><Link className="secondary-button" href="/coa">Check available COA</Link></div>
        <p className="batch-note">Price varies by specification and quantity. Request the currently available batch report before ordering.</p>
      </div>
    </section>
    {productCertificates.length>0 && <section className="product-reports section-pad"><div className="section-shell">
      <div className="section-heading"><div><p className="eyebrow">PUBLISHED ANALYTICAL DOCUMENTATION</p><h2>See the measured results.</h2></div><Link href="/coa">View all reports</Link></div>
      <div className="product-report-grid">{productCertificates.map(certificate=><article key={certificate.slug}>
        {certificate.reportImage && <Link className="product-report-image" href={`/coa/${certificate.slug}`}><Image src={assetPath(certificate.reportImage)} alt={`Report ${certificate.reportNumber} for ${certificate.name}`} fill sizes="(max-width: 700px) 100vw, 50vw" /></Link>}
        <div><span>{certificate.testType}</span><h3>{certificate.name}</h3>{certificate.measuredResult && <strong className="measured-result">{certificate.measuredResult}</strong>}<p>Report #{certificate.reportNumber} · Verification key {certificate.verificationKey}</p><div><Link href={`/coa/${certificate.slug}`}>View actual report</Link><a href={certificate.reportUrl} target="_blank" rel="noreferrer">Verify original ↗</a></div></div>
      </article>)}</div>
      <p className="report-disclaimer">Published reports identify the tested sample and batch shown in the document. They do not guarantee a different or future batch; request current batch documentation before purchase.</p>
    </div></section>}
    {knowledge && <section className="knowledge-section section-pad"><div className="section-shell knowledge-layout">
      <article className="knowledge-main">
        <p className="eyebrow">RESEARCH PROFILE</p><h2>What researchers study about {item.name}.</h2>
        <p className="knowledge-lead">{knowledge.shortDescription}</p>
        <div className="mechanism-list">{knowledge.mechanism.map((point,index)=><div key={point}><span>0{index+1}</span><p>{point}</p></div>)}</div>
      </article>
      <aside className="molecular-card">
        <div className="molecule-stage"><Image src={assetPath(knowledge.moleculeImage)} alt={`${item.name} molecular visualization`} fill sizes="(max-width: 700px) 100vw, 35vw" /></div>
        <p className="eyebrow">MOLECULAR PROFILE</p><dl>
          <div><dt>Full name</dt><dd>{knowledge.fullName}</dd></div>
          <div><dt>Sequence</dt><dd>{knowledge.sequence}</dd></div>
          <div><dt>Length</dt><dd>{knowledge.length}</dd></div>
          <div><dt>Molecular weight</dt><dd>{knowledge.molecularWeight}</dd></div>
          <div><dt>Origin</dt><dd>{knowledge.origin}</dd></div>
          <div><dt>Status</dt><dd>{knowledge.researchStatus}</dd></div>
        </dl>
      </aside>
    </div></section>}
    {knowledge && <section className="research-context section-pad"><div className="section-shell">
      <div className="section-heading"><div><p className="eyebrow">EVIDENCE, WITH CONTEXT</p><h2>Research without overclaiming.</h2></div></div>
      <div className="context-grid">{knowledge.researchContext.map((context,index)=><article key={context.title}><span>0{index+1}</span><h3>{context.title}</h3><p>{context.body}</p></article>)}</div>
      <div className="reference-list"><h3>Selected primary literature</h3>{knowledge.references.map(reference=><a key={reference.url} href={reference.url} target="_blank" rel="noreferrer"><span>{reference.journal}</span><strong>{reference.title}</strong><b>↗</b></a>)}</div>
    </div></section>}
    <section className="detail-info section-pad"><div className="section-shell info-grid"><article><span>01</span><h2>Batch documentation</h2><p>Ask for current batch-linked third-party documentation before ordering.</p></article><article><span>02</span><h2>Worldwide delivery</h2><p>USPS and FedEx options for the United States, with international fulfillment support.</p></article><article><span>03</span><h2>Custom presentation</h2><p>Label and packaging customization is normally completed in 1–2 weeks.</p></article></div></section>
    {knowledge && <section className="product-faq section-pad"><div className="section-shell faq-layout"><div><p className="eyebrow">PRODUCT FAQ</p><h2>Before you request a quote.</h2><p>Clear procurement answers, with research-use boundaries kept visible.</p><a className="primary-button" href={`${christineWhatsapp}?text=${message}`} target="_blank" rel="noreferrer">Ask Christine</a></div><div className="faq-list">{knowledge.faqs.map(faq=><details key={faq.question}><summary>{faq.question}<span>+</span></summary><p>{faq.answer}</p></details>)}</div></div></section>}
    {related.length>0 && <section className="related-products section-pad"><div className="section-shell"><div className="section-heading"><div><p className="eyebrow">RELATED CATALOG</p><h2>Explore the same research category.</h2></div><Link href="/peptide">Full catalog</Link></div><div className="related-grid">{related.map(product=><article key={product.slug}><span>{product.category}</span><h3><Link href={`/peptide/${product.slug}`}>{product.name}</Link></h3><p>{product.specs.join(" · ")}</p><Link href={`/peptide/${product.slug}`}>View specifications →</Link></article>)}</div></div></section>}
  </main><SiteFooter /></>;
}
