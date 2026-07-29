import Image from "next/image";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { assetPath } from "@/lib/site-config";
import { certificates, christineWhatsapp, featuredProducts, startingPrices, testimonials, whatsappChannel } from "@/lib/content";
import { ProductVisual } from "@/components/product-visual";

export default function Home() {
  return <><SiteHeader /><main>
    <section className="hero">
      <Image className="hero-image hero-market-image" src={assetPath("/images/jike/hero-global-market.jpg")} alt="Jike Peptide global research product supply" fill priority sizes="100vw" />
      <div className="section-shell hero-content">
        <div className="hero-copy">
          <p className="eyebrow">Jike Peptide Team · JikeBioTech</p>
          <h1>Research peptide supply, backed by verifiable data.</h1>
          <p>One-kit ordering, batch-linked third-party testing, worldwide delivery and custom packaging support for research customers.</p>
          <div className="button-row"><a className="primary-button" href={christineWhatsapp} target="_blank" rel="noreferrer">Ask Christine for price</a><Link className="secondary-button" href="/coa">Verify COA</Link></div>
          <div className="hero-proof"><span><b>1 kit</b>Minimum order</span><span><b>10 vials</b>Per kit</span><span><b>34 reports</b>Linked verification</span></div>
        </div>
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
          <div><span>{item.category}</span><h3><Link href={`/peptide/${item.slug}`}>{item.name}</Link></h3><p>{item.specs.join(" · ")}</p><p className="product-starting-price"><small>FROM</small> ${startingPrices[item.slug]} <em>/ kit</em></p></div>
        </article>)}</div>
      </div>
    </section>

    <section className="quality section-pad"><div className="section-shell quality-grid">
      <div><p className="eyebrow">QUALITY EVIDENCE</p><h2>Verify the report—not just the claim.</h2><p>Our COA center links directly to third-party report pages for available mass/purity and endotoxin tests. Request the current batch documentation before ordering.</p><Link className="primary-button" href="/coa">Explore COA center</Link></div>
      <div className="report-stack">{certificates.slice(0,4).map((item)=><a href={item.reportUrl} target="_blank" rel="noreferrer" key={item.slug}><span>{item.testType}</span><strong>{item.name}</strong><b>Verify ↗</b></a>)}</div>
    </div></section>

    <section className="section-pad home-company"><div className="section-shell home-company-grid">
      <div><p className="eyebrow">ABOUT JIKE PEPTIDE</p><h2>The international team of JikeBioTech.</h2><p>Jike Peptide Team supports research customers worldwide with catalog supply, batch documentation, order coordination and custom packaging.</p><p>Each standard kit contains 10 vials. Custom labels and packaging are typically prepared in 1–2 weeks.</p><a className="primary-button" href={christineWhatsapp} target="_blank" rel="noreferrer">Talk with Christine</a></div>
      <figure><video controls playsInline preload="metadata" poster={assetPath("/images/real/factory-poster.jpg")}><source src={assetPath("/video/factory.mp4")} type="video/mp4"/></video><figcaption>JikeBioTech company and factory overview</figcaption></figure>
    </div></section>

    <section className="section-pad reviews"><div className="section-shell">
      <div className="section-heading"><div><p className="eyebrow">CUSTOMER SHARES</p><h2>Real Customer Feedback</h2></div><a href={whatsappChannel} target="_blank" rel="noreferrer">More on WhatsApp Channel ↗</a></div>
      <div className="review-grid">{testimonials.slice(0,6).map(item=><blockquote key={item.name}>
        <figure><Image src={assetPath(item.image)} alt={`Order photo shared with ${item.name}'s delivery feedback`} fill sizes="(max-width: 700px) 100vw, 33vw" /></figure>
        <div className="review-copy"><div>“</div><p>{item.quote}</p><footer><strong>{item.name}</strong><span>{item.note}</span></footer></div>
      </blockquote>)}</div>
      <p className="review-note">Photos show real order preparation and product presentation. Customer names and comments are displayed as shared. Individual carrier transit times may vary.</p>
    </div></section>

    <section className="shipping section-pad"><div className="section-shell shipping-grid">
      <div><p className="eyebrow">U.S. DELIVERY</p><h2>Choose the speed that fits your order.</h2><p>Orders over $500 include complimentary USPS shipping. FedEx upgrades remain available.</p></div>
      <article><span>USPS</span><strong>$50</strong><p>10–15 business days after dispatch</p></article>
      <article><span>FedEx</span><strong>$80</strong><p>4–7 business days after dispatch</p></article>
    </div></section>

    <section className="final-cta"><div className="section-shell"><div><span>READY TO REQUEST A QUOTE?</span><h2>Send Christine your product list.</h2></div><a className="light-button" href={christineWhatsapp} target="_blank" rel="noreferrer">Start on WhatsApp →</a></div></section>
  </main><SiteFooter /></>;
}
