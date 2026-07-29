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
      <video className="hero-video" autoPlay muted loop playsInline preload="metadata" poster={assetPath("/images/real/factory-poster.jpg")} aria-hidden="true" tabIndex={-1}>
        <source src={assetPath("/video/hero-factory-loop.mp4")} type="video/mp4" />
      </video>
      <div className="section-shell hero-content">
        <div className="hero-copy">
          <p className="eyebrow">Jike Peptide Team · JikeBioTech</p>
          <h1>Research peptide supply, backed by verifiable data.</h1>
          <p>Multi-SKU wholesale supply, batch-linked analytical documentation and private-label support for research-sector buyers worldwide.</p>
          <div className="button-row"><a className="primary-button" href={christineWhatsapp} target="_blank" rel="noreferrer">Request a procurement quote</a><Link className="secondary-button" href="/coa">Review documentation</Link></div>
          <div className="hero-proof"><span><b>47 compounds</b>Catalog coverage</span><span><b>10 vials</b>Standard kit</span><span><b>34 reports</b>Linked verification</span></div>
        </div>
      </div>
    </section>

    <section className="trust-strip"><div className="section-shell">
      <span>Batch-linked COA</span><span>Wholesale multi-SKU supply</span><span>Private label & packaging</span><span>Worldwide fulfillment</span>
    </div></section>

    <section className="section-pad">
      <div className="section-shell">
        <div className="section-heading"><div><p className="eyebrow">POPULAR FIRST</p><h2>Most requested products</h2></div><Link href="/peptide">View full catalog →</Link></div>
        <div className="product-grid">{featuredProducts.slice(0,8).map((item)=><article className="product-card" key={item.slug}>
          <Link href={`/peptide/${item.slug}`}><ProductVisual item={item} /></Link>
          <div><span>{item.category}</span><h3><Link href={`/peptide/${item.slug}`}>{item.name}</Link></h3><p>{item.specs.join(" · ")}</p><Link className="product-procurement-link" href={`/peptide/${item.slug}`}>Specifications & procurement →</Link></div>
        </article>)}</div>
      </div>
    </section>

    <section className="market-strip"><div className="section-shell">
      <span>GLOBAL SUPPLY</span><p>United States</p><p>United Kingdom</p><p>Germany</p><p>Switzerland</p><p>Australia</p><p>Japan</p><p>Singapore</p><b>+ more</b>
    </div></section>

    <section className="section-pad b2b-audience"><div className="section-shell">
      <div className="b2b-heading"><div><p className="eyebrow">WHO WE SERVE</p><h2>Built for research-sector procurement.</h2></div><p>Commercial supply coordination for qualified buyers, with low-volume evaluation available before larger programs.</p></div>
      <div className="audience-grid">
        <article><span>01</span><h3>Independent Research Laboratories</h3></article>
        <article><span>02</span><h3>Peptide Distributors & Resellers</h3></article>
        <article><span>03</span><h3>Private-Label Product Teams</h3></article>
        <article><span>04</span><h3>Research Suppliers & Institutions</h3></article>
      </div>
    </div></section>

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

    <section className="procurement section-pad"><div className="section-shell">
      <div className="b2b-heading"><div><p className="eyebrow">WHOLESALE PEPTIDE PROCUREMENT</p><h2>A clear path from requirement to dispatch.</h2></div><p>Send one product or a multi-SKU list. Christine coordinates specifications, commercial terms, available documentation and fulfillment.</p></div>
      <div className="procurement-grid">
        <article><span>01</span><h3>Send requirements</h3><p>Product, specification, quantity, destination and packaging needs.</p></article>
        <article><span>02</span><h3>Review quotation</h3><p>Confirm pricing, stock status, documentation scope and shipping option.</p></article>
        <article><span>03</span><h3>Approve order</h3><p>Receive the pro forma details and confirm payment arrangements.</p></article>
        <article><span>04</span><h3>Fulfillment</h3><p>Batch confirmation, packing, dispatch and tracking coordination.</p></article>
      </div>
    </div></section>

    <section className="final-cta"><div className="section-shell"><div><span>READY TO REQUEST A QUOTE?</span><h2>Send Christine your product list.</h2></div><a className="light-button" href={christineWhatsapp} target="_blank" rel="noreferrer">Start on WhatsApp →</a></div></section>
  </main><SiteFooter /></>;
}
