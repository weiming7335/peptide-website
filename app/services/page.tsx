import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = { title: "Services", description: "Product supply, testing coordination, OEM, custom labels, cartons, storage cases, brand design, websites and global fulfillment." };

const labelPrices = [["Standard waterproof", "$0.10 / pc"], ["Spot UV", "$0.12 / pc"], ["Holographic", "$0.12 / pc"], ["Double-layer peel", "$0.15 / pc"]];
const cartonPrices = [["Standard folding carton", "$0.15 / pc"], ["Holographic carton", "$0.18 / pc"], ["Carton + paper insert", "$0.22 / pc"], ["Carton + EVA / foam insert", "$0.35 / pc"]];
const websitePackages = [["Launch Store", "$499", "Up to 15 products", "7–12 business days"], ["Growth Store", "$799", "Up to 30 products", "12–18 business days"], ["Scale Store", "$1,199", "Up to 50 products", "18–25 business days"]];
const packagingExamples = [
  ["Waterproof vial labels", "/services/vial-labels.png", "Label styles, finishes and customization process"],
  ["Vial paper cartons", "/services/paper-cartons.png", "Carton structures, inserts and style cases"],
  ["Plastic storage cases", "/services/storage-boxes.png", "Capacity options, custom cavities and logo cases"],
];
const websiteCases = [
  ["Wolverine Peptides", "/services/website-cases/wolverine-peptides.jpg", "Mobile storefront and affiliate dashboard"],
  ["Aminoswork", "/services/website-cases/aminoswork.jpg", "Structured catalogue and batch documentation"],
  ["Genetra.io", "/services/website-cases/genetra.jpg", "Mobile-first design and custom research tools"],
];

export default function ServicesPage() {
  return <><section className="section service-detail"><div className="shell"><header className="page-intro-block service-page-intro"><div><p className="eyebrow">FROM PRODUCT TO BRAND</p><h1>Services.</h1></div><p>Begin with one kit or build a complete private-label operation. Every service is quoted separately so you can choose only the support you need.</p></header><div className="split-section"><div><p className="eyebrow">PRODUCT SUPPLY</p><h2>One-kit ordering, wholesale and repeat supply.</h2><p>We support individual inquiries, resellers, wholesalers and brand operators. Product prices and current availability are confirmed privately by quotation.</p><ul className="check-list"><li>Minimum product order: 1 kit</li><li>Standard presentation: 10 sealed vials per kit</li><li>Retail, wholesale and repeat ordering</li><li>International fulfillment coordination</li></ul></div><div className="service-photo product-service-photo"><Image src="/products/Tesamorelin.png" alt="Jike Peptide product presentation" width={720} height={720} /></div></div></div></section>

    <section className="section service-band"><div className="shell split-section reverse"><div className="service-photo"><Image src="/services/brand-design.png" alt="Jike Peptide brand design package" width={680} height={1020} /></div><div><p className="eyebrow">BRAND DESIGN</p><h2>A complete visual system for your product line.</h2><p>The $499 launch offer covers the full initial SKU lineup, not a single label. All work is prepared for commercial use and delivered in print-ready source formats.</p><div className="price-highlight"><span>Launch offer</span><strong>$499</strong><small>one-time design fee · 7–12 business days</small></div><ul className="check-list"><li>Two initial logo concepts and primary brand mark</li><li>Color, typography and mini brand guide</li><li>Vial labels and 1–10 vial packaging design</li><li>Brand card and social media assets</li><li>Three revision rounds and source files</li></ul><p className="micro-copy">Additional SKU after project: $10 · Promotional graphic: $10/image</p></div></div></section>

    <section className="section"><div className="shell"><div className="section-heading"><div><p className="eyebrow">PACKAGING</p><h2>Production-ready labels and boxes.</h2></div><p className="section-heading-copy">Prices are references. Final quotations depend on size, artwork, finish, insert type and quantity.</p></div>
      <div className="packaging-showcase">{packagingExamples.map(([name, image, description]) => <a href={image} target="_blank" rel="noreferrer" key={name}><div><Image src={image} alt={`${name} service examples`} width={724} height={2172} /></div><span>{description}</span><h3>{name}</h3><strong>View full guide ↗</strong></a>)}</div>
      <div className="pricing-grid"><article><span className="pricing-tag">MOQ 1,000</span><h3>Waterproof vial labels</h3>{labelPrices.map(([name, price]) => <div className="price-row" key={name}><span>{name}</span><strong>from {price}</strong></div>)}</article><article><span className="pricing-tag">MOQ 1,000</span><h3>Vial paper cartons</h3>{cartonPrices.map(([name, price]) => <div className="price-row" key={name}><span>{name}</span><strong>from {price}</strong></div>)}</article><article><span className="pricing-tag">MOQ 500</span><h3>Plastic storage cases</h3><div className="large-price">from <strong>$0.15</strong> / pc</div><p>Custom cavity count, box size and logo. Supports multiple common vial sizes.</p><small>Reference lead time: 7–15 working days</small></article></div>
    </div></section>

    <section className="section website-services"><div className="shell"><div className="section-heading"><div><p className="eyebrow">E-COMMERCE WEBSITE SUPPORT</p><h2>Structured product websites for growing brands.</h2></div><a className="text-link" href="/services/ecommerce-packages.pdf" target="_blank">Download full package guide ↗</a></div>
      <div className="website-case-grid">{websiteCases.map(([name, image, description]) => <figure key={name}><Image src={image} alt={`${name} public website reference`} width={1221} height={863} /><figcaption><strong>{name}</strong><span>{description}</span></figcaption></figure>)}</div>
      <div className="website-package-grid">{websitePackages.map(([name, price, products, timeline], index) => <article className={index === 1 ? "popular" : ""} key={name}>{index === 1 && <span className="popular-label">MOST POPULAR</span>}<h3>{name}</h3><strong>{price}</strong><p>{products}</p><small>{timeline}</small></article>)}</div><div className="optional-services"><span>Additional product upload · $5/product</span><span>Website maintenance · $49/month</span><span>SEO & content · from $149/month</span><span>50% deposit · 50% before launch</span></div></div></section>

    <section className="service-end"><div className="shell"><div><p className="eyebrow eyebrow-light">OEM · TESTING · FULFILLMENT</p><h2>Need a combination of services?</h2><p>Describe the product, quantity, packaging, testing and launch support you need. We will prepare a scoped quotation.</p></div><Link className="button" href="/request-a-quote">Build your request</Link></div></section>
  </>;
}
