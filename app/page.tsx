import { LandingQuoteForm } from "@/components/landing-quote-form";
import { assetPath } from "@/lib/site-config";

const whatsapp = "https://wa.me/12137038679?text=Hi%20Christine%2C%20I%20represent%20a%20commercial%20buyer%20and%20would%20like%20to%20discuss%20peptide%20manufacturing%2C%20wholesale%20or%20OEM%20supply.";

export default function Home() {
  return <div className="landing-page">
    <main>
      <section className="lp-hero">
        <div className="lp-hero-copy">
          <img className="lp-logo" src={assetPath("/images/jike-logo.png")} alt="Jike Peptide" />
          <p className="lp-kicker">B2B PEPTIDE MANUFACTURING</p>
          <h1>Reliable supply for growing product businesses.</h1>
          <p className="lp-lead">Flexible wholesale orders, OEM packaging and batch-specific analytical documentation for qualified distributors, research suppliers and commercial buyers.</p>
          <div className="lp-actions">
            <a className="lp-button lp-button-primary" href="#inquiry">Request a quote <span>→</span></a>
            <a className="lp-button lp-button-secondary" href={whatsapp} target="_blank" rel="noreferrer">WhatsApp procurement</a>
          </div>
          <p className="lp-boundary">Commercial supply only · Buyer and destination review required</p>
        </div>

        <div className="lp-video-wrap">
          <video autoPlay muted loop playsInline preload="metadata" poster={assetPath("/images/factory-landing-poster.jpg")} aria-label="Production staff operating packaging equipment in a controlled facility">
            <source src={assetPath("/video/factory-landing.mp4")} type="video/mp4" />
          </video>
          <div className="lp-video-label"><i /> Actual production footage</div>
        </div>
      </section>

      <section className="lp-proof" aria-labelledby="proof-title">
        <div className="lp-section-intro">
          <p className="lp-kicker">DOCUMENTATION BEFORE ORDER</p>
          <h2 id="proof-title">Know what is available for the quoted batch.</h2>
          <p>Documentation scope is confirmed with the quotation and tied to the available lot.</p>
        </div>
        <div className="lp-proof-grid">
          <article><span>01</span><h3>Batch COA</h3><p>Lot identity and specification details confirmed before order approval.</p></article>
          <article><span>02</span><h3>Analytical records</h3><p>Available HPLC and mass spectrometry records reviewed for the quoted batch.</p></article>
          <article><span>03</span><h3>Packaging confirmation</h3><p>Format, label artwork and production scope agreed in writing for OEM orders.</p></article>
        </div>
      </section>

      <section className="lp-capabilities" aria-labelledby="capabilities-title">
        <div className="lp-section-intro">
          <p className="lp-kicker">COMMERCIAL SUPPLY</p>
          <h2 id="capabilities-title">A practical route from evaluation to repeat orders.</h2>
        </div>
        <div className="lp-capability-grid">
          <article><div className="lp-icon">A</div><h3>Flexible wholesale</h3><p>Qualifying evaluation orders and recurring volume supply, subject to availability and buyer verification.</p></article>
          <article><div className="lp-icon">B</div><h3>OEM &amp; private label</h3><p>Custom labels, boxes and presentation options prepared against an approved commercial brief.</p></article>
          <article><div className="lp-icon">C</div><h3>International fulfillment</h3><p>Cross-border B2B dispatch coordinated according to destination requirements and approved order terms.</p></article>
        </div>
      </section>

      <section className="lp-inquiry" id="inquiry">
        <div className="lp-inquiry-copy">
          <p className="lp-kicker">PROCUREMENT INQUIRY</p>
          <h2>Tell us what your business needs.</h2>
          <p>Send your target specification, estimated quantity, market and packaging requirements. We will review buyer fit and reply with the available documentation and quotation scope.</p>
          <a className="lp-direct" href={whatsapp} target="_blank" rel="noreferrer"><span>Prefer WhatsApp?</span><strong>Talk with Christine ↗</strong></a>
        </div>
        <LandingQuoteForm />
      </section>
    </main>

    <footer className="lp-footer">
      <div className="lp-footer-brand"><img src={assetPath("/images/jike-logo.png")} alt="Jike Peptide logo" /><div><strong>JIKE PEPTIDE</strong><small>B2B Manufacturing</small></div></div>
      <p>Commercial supply only. Orders are subject to buyer qualification, end-use review, applicable laws and destination requirements. No medical advice or therapeutic claims are provided.</p>
      <div className="lp-footer-meta"><a href="mailto:christinepeptide@gmail.com">christinepeptide@gmail.com</a><a href="/privacy-policy">Privacy policy</a><span>© 2026 Jike Biotech (Guangzhou) Co., Ltd.</span></div>
    </footer>

    <a className="lp-mobile-whatsapp" href={whatsapp} target="_blank" rel="noreferrer">WhatsApp</a>
  </div>;
}
