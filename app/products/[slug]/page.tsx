import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { productDetails } from "@/lib/product-details";
import { getProduct, products } from "@/lib/products";
import { christineWhatsapp } from "@/lib/site";

type ProductPageProps = { params: Promise<{ slug: string }> };

export function generateStaticParams() { return products.map((product) => ({ slug: product.slug })); }

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const product = getProduct((await params).slug);
  return product ? { title: product.name, description: `${product.name} specifications and downloadable product data sheet from Jike Peptide.` } : {};
}

export default async function ProductPage({ params }: ProductPageProps) {
  const product = getProduct((await params).slug);
  if (!product) notFound();
  const details = productDetails[product.name];
  if (!details) notFound();
  const composition = details.sequence
    ? ["Sequence", details.sequence]
    : details.activeComponents
      ? ["Active components", details.activeComponents]
      : details.proteinStructure
        ? ["Protein structure", details.proteinStructure]
        : null;
  const message = encodeURIComponent(`Hello, I would like a quote for ${product.name}. Please confirm available specifications and current documentation.`);
  return <>
    <section className="product-detail"><div className="shell">
      <div className="breadcrumbs"><Link href="/products">Products</Link><span>/</span><span>{product.name}</span></div>
      <div className="product-detail-grid">
        <div className="product-detail-image"><Image src={product.image} alt={`${product.name} product presentation`} width={900} height={900} priority /></div>
        <div className="product-detail-copy"><p className="eyebrow">PRODUCT DATA SHEET</p><h1>{product.name}</h1><p className="product-lead">{details.form}. {details.appearance} Review the catalog presentations below and request current availability and lot documentation.</p>
          <div className="product-quick-facts"><div><span>Packaging</span><strong>{details.packaging}</strong></div><div><span>Intended use</span><strong>{details.intendedUse}</strong></div></div>
          <div className="spec-table"><div className="spec-head"><span>Catalog code</span><span>Presentation</span></div>{product.specs.map((item) => <div className="spec-row" key={item.code}><strong>{item.code}</strong><span>{item.presentation}</span></div>)}</div>
          <div className="button-row"><Link className="button" href={`/request-a-quote?product=${product.slug}`}>Request a Quote</Link><a className="button button-outline" href={product.dataSheet} download>Download Data Sheet</a></div>
          <a className="whatsapp-link" href={`${christineWhatsapp}?text=${message}`} target="_blank" rel="noreferrer">Ask about this product on WhatsApp ↗</a>
        </div>
      </div>
    </div></section>
    <section className="section product-information"><div className="shell product-information-grid">
      <article className="product-data-panel"><p className="eyebrow">PRODUCT INFORMATION</p><h2>Identity and presentation.</h2><dl className="product-data-list">
        <div><dt>Form</dt><dd>{details.form}</dd></div>
        <div><dt>Appearance</dt><dd>{details.appearance}</dd></div>
        {details.casNumber && <div><dt>CAS No.</dt><dd>{details.casNumber}</dd></div>}
        {composition && <div className="composition-row"><dt>{composition[0]}</dt><dd>{composition[1]}</dd></div>}
        <div><dt>Packaging</dt><dd>{details.packaging}</dd></div>
        <div><dt>Intended use</dt><dd>{details.intendedUse}</dd></div>
      </dl></article>
      <div className="product-support-panels">
        <article className="product-support-panel"><p className="eyebrow">COA &amp; TESTING</p><h2>Lot documentation.</h2><ul className="check-list"><li>Lot-specific Certificate of Analysis available for each production lot.</li><li>HPLC analysis documents purity and chromatographic profile.</li><li>Mass spectrometry may be used to confirm compound identity.</li><li>Final test results are reported in the COA supplied with the lot.</li></ul></article>
        <article className="product-support-panel storage-panel"><p className="eyebrow">STORAGE &amp; HANDLING</p><h2>Material handling.</h2><div><span>Lyophilized material</span><p>{details.storage.lyophilized}</p></div><div><span>After reconstitution</span><p>{details.storage.reconstituted}</p></div></article>
      </div>
    </div></section>
    <section className="detail-cta"><div className="shell"><div><p className="eyebrow eyebrow-light">INDEPENDENT TESTING</p><h2>Browse our public report library.</h2></div><Link className="button" href="/third-party-testing">View test reports</Link></div></section>
  </>;
}
