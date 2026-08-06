import Image from "next/image";
import Link from "next/link";
import { ProductCard } from "@/components/product-card";
import { featuredProducts } from "@/lib/products";

const services = [
  ["01", "Product supply", "One-kit ordering for individuals, resellers, wholesalers and repeat procurement."],
  ["02", "Independent testing", "Shared-cost Janoshik testing coordination with original verification reports."],
  ["03", "OEM & private label", "Labels, cartons, storage cases and selected OEM programs for growing brands."],
  ["04", "Brand materials", "Logo systems, print-ready packaging, inserts, cards and digital product assets."],
  ["05", "Website support", "Mobile-ready e-commerce builds with structured product and report libraries."],
  ["06", "Global fulfillment", "International order coordination subject to destination and carrier requirements."],
];

export default function HomePage() {
  return <>
    <section className="home-hero">
      <video autoPlay muted loop playsInline preload="metadata" poster="/brand/factory-frame.jpg">
        <source src="/video/factory.mp4" type="video/mp4" />
      </video>
      <div className="hero-overlay"></div>
      <div className="shell hero-content">
        <p className="eyebrow eyebrow-light">PRODUCTS · TESTING · PACKAGING · BRANDING · SHIPPING</p>
        <h1>You focus on sales.<br /><span>We support the rest.</span></h1>
        <p>Jike Peptide connects product supply, independent testing coordination and brand-ready services in one clear workflow.</p>
        <div className="button-row"><Link className="button" href="/products">Explore Products</Link><Link className="button button-ghost" href="/request-a-quote">Request a Quote</Link></div>
      </div>
      <div className="hero-proof shell"><span><strong>42</strong> catalog products</span><span><strong>1 kit</strong> minimum order</span><span><strong>34</strong> public test reports</span><span><strong>Global</strong> order support</span></div>
    </section>

    <section className="section section-intro">
      <div className="shell intro-grid">
        <div><p className="eyebrow">ONE PARTNER. THE WHOLE WORKFLOW.</p><h2>From a single kit to a complete brand system.</h2></div>
        <div><p>Start with the products and specifications you need. Add independent testing coordination, custom packaging, brand materials, website support and international fulfillment as your business grows.</p><Link className="text-link" href="/services">See all services ↗</Link></div>
      </div>
    </section>

    <section className="section section-products">
      <div className="shell">
        <div className="section-heading"><div><p className="eyebrow">CATALOG</p><h2>Selected products.</h2></div><Link className="button button-outline" href="/products">View all 42</Link></div>
        <div className="product-grid featured-grid">{featuredProducts.slice(0, 6).map((product) => <ProductCard product={product} key={product.slug} />)}</div>
      </div>
    </section>

    <section className="section testing-feature">
      <div className="shell testing-feature-grid">
        <div className="testing-copy"><p className="eyebrow eyebrow-light">INDEPENDENT THIRD-PARTY TESTING</p><h2>Original reports. Direct verification.</h2><p>Our public library presents Janoshik reports exactly as issued, including sample identifiers, report numbers and original verification links.</p><div className="testing-points"><span>Content & purity</span><span>Endotoxin</span><span>Batch identifiers</span></div><Link className="button" href="/third-party-testing">Browse all reports</Link></div>
        <div className="report-stack"><Image src="/testing/report-198338.png" alt="Janoshik content and purity report" width={480} height={708} /><Image src="/testing/report-198339.png" alt="Janoshik endotoxin report" width={480} height={708} /></div>
      </div>
    </section>

    <section className="section services-section">
      <div className="shell"><div className="section-heading"><div><p className="eyebrow">WHAT WE SUPPORT</p><h2>Built around the way you sell.</h2></div><p className="section-heading-copy">Choose only what you need now, then add services as your catalogue and brand expand.</p></div>
        <div className="service-grid">{services.map(([number, title, copy]) => <article key={number}><span>{number}</span><h3>{title}</h3><p>{copy}</p></article>)}</div>
      </div>
    </section>

    <section className="section factory-section">
      <div className="shell">
        <div className="factory-heading"><div><p className="eyebrow">MANUFACTURING CAPABILITIES</p><h2>Real production, shown as it is.</h2></div><p>A single view of our lyophilization, R&amp;D, production, labeling, packaging and in-stock supply capabilities.</p></div>
        <figure className="factory-capabilities">
          <Image src="/factory/manufacturing-capabilities.webp" alt="Jike Peptide manufacturing capabilities including lyophilization, R&D laboratory, production workshops, labeling, packaging and inventory" width={1448} height={1086} sizes="(max-width: 1228px) calc(100vw - 48px), 1180px" />
        </figure>
      </div>
    </section>

    <section className="final-cta"><div className="shell"><p className="eyebrow eyebrow-light">READY WHEN YOU ARE</p><h2>Tell us what you want to source, test or build.</h2><p>Send the product, specification, quantity and service requirements. We will reply with the next practical step.</p><Link className="button" href="/request-a-quote">Request a Quote</Link></div></section>
  </>;
}
