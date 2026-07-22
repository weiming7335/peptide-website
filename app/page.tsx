import Image from "next/image";
import Link from "next/link";
import { WhatsAppIcon } from "@/components/whatsapp-icon";
import { assetPath } from "@/lib/site-config";

const products = [
  ["MOTS-C", "mots-c", "/images/product/MOTS-C.png"],
  ["MT-2", "mt-2", "/images/product/MT-2.png"],
  ["Cagrilin", "cagrilin", "/images/product/Cagrilin.png"],
  ["Epithalon", "epithalon", "/images/product/Epithalon.png"],
  ["NAD+", "nad-plus", "/images/product/NAD+.png"],
  ["GLOW", "glow", "/images/product/GLOW.png"],
  ["BPC157 + TB500", "bpc157-tb500", "/images/product/BPC157+TB500.png"],
  ["TB500", "tb500", "/images/product/TB500.png"],
];

const advantages = [
  ["shield", "Guaranteed Purity", "Advanced production technology ensures consistent, high-purity peptides for demanding applications."],
  ["check", "Trade Assurance", "Purchase with confidence through our dependable trade guarantee services."],
  ["card", "Flexible Payment Options", "Support PayPal, USDT, USDC, Wise and T/T for convenient, secure transactions."],
  ["people", "Expert Sales Team", "Responsive, multilingual and knowledgeable — we are ready to assist 24/7."],
];

const faqs = [
  ["What types of peptides do you manufacture?", "We specialize in custom peptides, research-grade peptides, cosmetic peptides, lyophilized powders and raw materials for pharmaceutical research applications."],
  ["What is the typical purity of your peptides?", "Our peptides are typically ≥99% pure, with a detailed Certificate of Analysis available for qualified batches."],
  ["Why are the products marked ‘Research Use Only’?", "Our products are supplied exclusively for laboratory research and analytical use. They are not intended for human consumption, diagnosis or treatment."],
  ["What if I need technical support after purchasing?", "Our technical and sales support team can answer product, documentation and logistics questions before or after purchase through WhatsApp."],
  ["How do you reconstitute powdered peptides?", "Our products are supplied for qualified laboratory research only. Please follow your institution’s validated protocol and applicable safety requirements."],
  ["How is each product packaged to ensure stability?", "Peptides are lyophilized and sealed in vials. Appropriate protective packaging is selected according to the destination and shipping conditions."],
  ["Do you ship internationally?", "Yes. We support secure international delivery with full shipment tracking and responsive logistics assistance."],
  ["Where are orders shipped from?", "International orders are consolidated through our export logistics network and dispatched with full tracking information."],
  ["What payment methods do you accept?", "Available payment methods are confirmed by our sales specialist during the quotation process."],
  ["How long does order processing take?", "Lead time depends on the product, quantity and documentation requirements. Our team will confirm the schedule before you place an order."],
  ["Do you support custom or bulk orders?", "Yes. Contact our sales team on WhatsApp with your target sequence, specification and estimated quantity for a tailored quotation."],
];

function Icon({ name }: { name: string }) {
  const paths: Record<string, React.ReactNode> = {
    shield: <path d="M12 3l7 3v5c0 4.6-2.8 8.6-7 10-4.2-1.4-7-5.4-7-10V6l7-3zm-3.1 9l2 2 4.6-4.7" />,
    check: <path d="M12 2l2.2 2.2 3.1-.4.5 3.1L20 9l-1.5 2.8.5 3.1-3.1.5L14 18l-2 4-2-4-2.9-2.6-3.1-.5.5-3.1L3 9l2.2-2.1.5-3.1 3.1.4L12 2zm-3 9.5l2 2 4-4" />,
    card: <path d="M3 6h18v12H3zM3 10h18M7 15h3" />,
    people: <path d="M16 20v-2c0-2.2-1.8-4-4-4H6c-2.2 0-4 1.8-4 4v2m7-10a4 4 0 100-8 4 4 0 000 8zm13 10v-2c0-1.8-1.2-3.4-3-3.9m-2.2-11.9a4 4 0 010 7.7" />,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
}

export default function Home() {
  return (
    <main>
      <div className="announcement">
        <div className="announcement-track">
          <div className="announcement-group"><span>What Is Peptide Purity and Why Does It Matter in Research-Grade Peptides?</span><span>How to Verify Leaxion Official Business Contacts</span></div>
          <div className="announcement-group" aria-hidden="true"><span>What Is Peptide Purity and Why Does It Matter in Research-Grade Peptides?</span><span>How to Verify Leaxion Official Business Contacts</span></div>
        </div>
      </div>
      <header className="site-header">
        <div className="nav-shell">
          <Link className="brand" href="/" aria-label="Leaxion home"><Image src={assetPath("/images/logo/logo-leaxionpng.png")} alt="Leaxion" width={230} height={92} priority /></Link>
          <nav aria-label="Main navigation">
            <Link className="active" href="/">Home</Link><Link href="/peptide">Peptide</Link><Link href="/coa">COA</Link><Link href="/blog">Blog</Link><Link href="/about">About us</Link><Link href="/contact">Contact US</Link>
          </nav>
          <details className="mobile-menu"><summary aria-label="Open navigation">Menu</summary><div><Link href="/">Home</Link><Link href="/peptide">Peptide</Link><Link href="/coa">COA</Link><Link href="/blog">Blog</Link><Link href="/about">About us</Link><Link href="/contact">Contact US</Link><Link href="/faq">F.A.Q.</Link></div></details>
          <a className="quote-button" href="https://wa.me/12137038679" target="_blank" rel="noreferrer">Quote Now <span>→</span></a>
        </div>
      </header>

      <section className="hero" id="home">
        <Image className="hero-image" src={assetPath("/images/hero-peptide-laboratory.png")} alt="Peptide manufacturing laboratory and research vials" fill priority sizes="100vw" />
        <div className="hero-shade" />
        <div className="hero-content section-shell">
          <h1>Reliable, High-Quality<br />Peptides for Research,<br />Pharmaceuticals, and Biotech</h1>
        </div>
      </section>

      <section className="advantages">
        <div className="section-shell">
          <div className="intro-line"><h2><span>Leaxion Peptide:</span> 7 years of trusted peptide manufacturing and fast global delivery.</h2><p>WHY CHOOSE US</p></div>
          <div className="advantage-grid">
            {advantages.map(([icon, title, text]) => <article key={title}><div className="icon-box"><Icon name={icon} /></div><div><h3>{title}</h3><p>{text}</p></div></article>)}
          </div>
        </div>
      </section>

      <section className="products section-pad" id="products">
        <div className="section-shell">
          <div className="section-heading"><div><p className="eyebrow">PRODUCT LINE</p><h2>Products Categories</h2></div><Link href="/peptide">MORE PRODUCTS <span>→</span></Link></div>
          <div className="product-grid">
            {products.map(([name, slug, src]) => <article className="product-card" key={name}><div className="product-image"><Image src={assetPath(src)} alt={`${name} research peptide`} fill sizes="(max-width: 700px) 50vw, 25vw" /></div><div className="product-overlay"><Link href={`/peptide/${slug}`}>View More</Link><h3>{name}</h3></div></article>)}
          </div>
        </div>
      </section>

      <section className="about" id="about">
        <div className="about-image"><Image src={assetPath("/images/about-us-1200x800-1-print.png")} alt="Leaxion peptide manufacturing facility" fill sizes="50vw" /></div>
        <div className="about-copy"><p className="eyebrow light">READ MORE</p><h2>About Us</h2><p>With over 7 years of experience in peptide production, Leaxion specializes in research peptides, beauty peptides and custom peptide services.</p><p>We focus on innovation, strict quality control and responsive customer service, supporting custom and bulk requirements with traceable documentation for customers worldwide.</p><Link className="outline-button" href="/about">DISCOVER LEAXION <span>→</span></Link></div>
      </section>

      <section className="certifications section-pad" id="certifications">
        <div className="section-shell certification-layout">
          <div className="cert-copy"><p className="eyebrow">QUALITY VERIFIED</p><h2>Certifications</h2><p>Finished products are randomly sampled and submitted for independent laboratory testing. Certificates of Analysis provide transparent documentation for every qualified batch.</p><Link href="/coa" className="text-link">VIEW ALL CERTIFICATES <span>→</span></Link></div>
          <div className="coa-cards">
            {[["Tirzepatide 15 mg","tirzepatide-15mg","/images/COA/Tirzepatide 15 mg.jpg"],["BPC-157 10 mg","bpc-157-10mg","/images/COA/BPC-157 10 mg.webp"],["NAD+ 500 mg","nad-plus-500mg","/images/COA/NAD+ 500 mg.jpg"]].map(([name,slug,src])=><article key={name}><div><Image src={assetPath(src)} alt={name + " certificate of analysis"} fill sizes="25vw" /></div><h3>{name}</h3><Link href={`/coa/${slug}`}>View More</Link></article>)}
          </div>
        </div>
      </section>

      <section className="stats"><div className="section-shell stats-grid">{[["320+","Satisfied Clients Worldwide"],["200+","Product SKUs"],["4","International Awards"],["35+","Countries Served"]].map(([n,l])=><div key={l}><strong>{n}</strong><span>{l}</span></div>)}</div></section>

      <section className="resources section-pad" id="resources">
        <div className="section-shell"><div className="section-heading"><div><p className="eyebrow">OUR RESOURCES</p><h2>News, Trends &amp; Blog</h2></div><Link href="/blog">VIEW ALL ARTICLES <span>→</span></Link></div>
          <div className="blog-grid">
            {[["Beware of Imposters and Verify Leaxion Official Contacts","verify-peptide-suppliers","/images/blog/verify-peptide-suppliers.png","4 MAR 2026"],["BPC157 Supplier: Why Leaxion Is Your Trusted Partner","bpc157-supplier","/images/blog/bpc157-supplier.png","8 MAR 2026"],["How to Choose a Reliable Peptide Manufacturer for Your Business Needs","choosing-a-peptide-manufacturer","/images/blog/choosing-a-peptide-manufacturer.png","12 MAR 2026"]].map(([title,slug,image,date])=><article key={title}><Link className="blog-image" href={`/blog/${slug}`}><Image src={assetPath(image)} alt={title} fill sizes="(max-width: 640px) 100vw, 33vw" /></Link><div className="blog-body"><span>INSIGHTS · {date}</span><h3>{title}</h3><Link href={`/blog/${slug}`}>Read More <b>→</b></Link></div></article>)}
          </div>
          <div className="resource-links"><Link href="/blog/beauty-peptide-supplier">Beauty Peptide Supplier: Leaxion Peptide</Link><Link href="/blog/research-peptide-suppliers">Research Peptide Suppliers: Trusted Manufacturing Expertise</Link><Link href="/blog/tb500-peptide-supplier">TB500 Peptide Supplier: Why Leaxion Is Your Ideal Partner</Link></div>
        </div>
      </section>

      <section className="faq section-pad"><div className="section-shell faq-layout"><div><p className="eyebrow">OUR RESOURCES</p><h2>Frequently Asked Questions</h2><p>Find concise answers about our products, documentation, packaging and worldwide service.</p></div><div className="faq-list">{faqs.map(([q,a],i)=><details key={q} open={i===0}><summary>{q}<span>+</span></summary><p>{a}</p></details>)}</div></div></section>

      <footer><div className="section-shell footer-grid"><div className="footer-brand"><Image src={assetPath("/images/logo/logo-leaxionpng.png")} alt="Leaxion" width={220} height={88} /><p>High-Purity Peptides Manufacturer | 7+ Years</p></div><div><h3>Company</h3><Link href="/">Home</Link><Link href="/about">About Us</Link><Link href="/contact">Contact Us</Link><Link href="/faq">F.A.Q.</Link></div><div><h3>Products</h3><Link href="/peptide">All Products</Link><Link href="/peptide">Research Peptides</Link><Link href="/coa">Certificates</Link><a href="https://wa.me/12137038679">Custom Peptides</a></div><div><h3>Connect Us</h3><a href="https://wa.me/12137038679" target="_blank" rel="noreferrer">WhatsApp: +1 213 703 8679</a><a href="https://wa.me/12137038679" target="_blank" rel="noreferrer">Request a Quote</a><Link href="/privacy-policy">Privacy Policy</Link></div></div><div className="copyright section-shell"><span>© 2026 Leaxion. All Rights Reserved.</span><span>RESEARCH USE ONLY</span></div></footer>
      <a className="floating-contact whatsapp" href="https://wa.me/12137038679" target="_blank" rel="noreferrer" aria-label="Contact Leaxion on WhatsApp"><WhatsAppIcon /></a>
    </main>
  );
}
