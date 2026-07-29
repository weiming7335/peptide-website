import Image from "next/image";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { assetPath } from "@/lib/site-config";
import { certificates, christineWhatsapp, featuredProducts, testimonials, whatsappChannel } from "@/lib/content";
import { ProductVisual } from "@/components/product-visual";

export default function Home() {
  return <><SiteHeader /><main>
    <section className="hero">
      <Image className="hero-image" src={assetPath("/images/jike/hero-vials-red.jpg")} alt="" fill priority sizes="100vw" />
      <div className="section-shell hero-content">
        <p className="eyebrow">Jike Peptide Team · JikeBioTech</p>
        <h1>Research peptide supply, backed by verifiable data.</h1>
        <p>One-kit ordering, batch-linked third-party testing, worldwide delivery and custom packaging support for research customers.</p>
        <div className="button-row"><a className="primary-button" href={christineWhatsapp} target="_blank" rel="noreferrer">Ask Christine for price</a><Link className="secondary-button" href="/coa">Verify COA</Link></div>
        <div className="hero-proof"><span><b>1 kit</b>Minimum order</span><span><b>10 vials</b>Per kit</span><span><b>34 reports</b>Linked verification</span></div>
      </div>
    </section>

    <section className="trust-strip"><div className="section-shell">
      <span>Third-party COA links</span><span>USPS & FedEx options</span><span>Custom label & packaging</span><span>Worldwide fulfillment</span>
    </div></section>

    <section className="section-pad">
      <div className="section-shell">
        <div className="section-heading"><div><p className="eyebrow">POPULAR FIRST</p><h2>Most requested products</h2></div><Link href="/peptide">View full catalog →</Link></div>
        <div className="product-grid">{featuredProducts.slice(0,8).map((item)=><article className="product-card" key={item.slug}>
          <Link href={`/peptide/${item.slug}`}><ProductVisual item={item} /></Link>
          <div><span>{item.category}</span><h3><Link href={`/peptide/${item.slug}`}>{item.name}</Link></h3><p>{item.specs.join(" · ")}</p></div>
        </article>)}</div>
      </div>
    </section>

    <section className="quality section-pad"><div className="section-shell quality-grid">
      <div><p className="eyebrow">QUALITY EVIDENCE</p><h2>Verify the report—not just the claim.</h2><p>Our COA center links directly to third-party report pages for available mass/purity and endotoxin tests. Request the current batch documentation before ordering.</p><Link className="primary-button" href="/coa">Explore COA center</Link></div>
      <div className="report-stack">{certificates.slice(0,4).map((item)=><a href={item.reportUrl} target="_blank" rel="noreferrer" key={item.slug}><span>{item.testType}</span><strong>{item.name}</strong><b>Verify ↗</b></a>)}</div>
    </div></section>

    <section className="section-pad real-proof"><div className="section-shell">
      <div className="section-heading"><div><p className="eyebrow">REAL OPERATIONS</p><h2>Stock, preparation and fulfillment</h2></div><Link href="/about">See our company →</Link></div>
      <div className="proof-gallery">
        <figure className="wide"><Image src={assetPath("/images/real/inventory.jpg")} alt="Research product inventory" fill sizes="60vw" /><figcaption>Organized ready stock</figcaption></figure>
        <figure><Image src={assetPath("/images/real/order-sorting.jpg")} alt="Order preparation" fill sizes="40vw" /><figcaption>Order preparation</figcaption></figure>
        <figure><Image src={assetPath("/images/real/custom-kits.jpg")} alt="Custom research kits" fill sizes="40vw" /><figcaption>Custom kit support</figcaption></figure>
      </div>
    </div></section>

    <section className="section-pad reviews"><div className="section-shell">
      <div className="section-heading"><div><p className="eyebrow">CUSTOMER SHARES</p><h2>Real delivery feedback</h2></div><a href={whatsappChannel} target="_blank" rel="noreferrer">More on WhatsApp Channel ↗</a></div>
      <div className="review-grid">{testimonials.slice(0,6).map(item=><blockquote key={item.name}><div>“</div><p>{item.quote}</p><footer><strong>{item.name}</strong><span>{item.note}</span></footer></blockquote>)}</div>
      <p className="review-note">Customer names are displayed as shared. Individual carrier transit times may vary. Reviews describe service and delivery experiences only.</p>
    </div></section>

    <section className="shipping section-pad"><div className="section-shell shipping-grid">
      <div><p className="eyebrow">U.S. DELIVERY</p><h2>Choose the speed that fits your order.</h2><p>Orders over $500 include complimentary USPS shipping. FedEx upgrades remain available.</p></div>
      <article><span>USPS</span><strong>$50</strong><p>10–15 business days after dispatch</p></article>
      <article><span>FedEx</span><strong>$80</strong><p>4–7 business days after dispatch</p></article>
    </div></section>

    <section className="final-cta"><div className="section-shell"><div><span>READY TO REQUEST A QUOTE?</span><h2>Send Christine your product list.</h2></div><a className="light-button" href={christineWhatsapp} target="_blank" rel="noreferrer">Start on WhatsApp →</a></div></section>
  </main><SiteFooter /></>;
}
