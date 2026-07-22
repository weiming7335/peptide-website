import Image from "next/image";
import Link from "next/link";
import { PageHero } from "@/components/page-hero";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { WhatsAppIcon } from "@/components/whatsapp-icon";
import { products } from "@/lib/content";
import { assetPath } from "@/lib/site-config";

const salesExperts = [
  { name: "Christine", phone: "+1 213 703 8679", whatsapp: "https://wa.me/12137038679" },
  { name: "Emma", phone: "+1 909 459 9735", whatsapp: "https://wa.me/19094599735" },
  { name: "Luna", phone: "+852 9841 7612", whatsapp: "https://wa.me/85298417612" },
];

export default function AboutPage() {
  return <><SiteHeader /><main><PageHero title="About us" />
    <section className="about-intro section-pad"><div className="section-shell"><h2>Trusted Peptide Manufacturer with 7+ Years of Experience</h2><p>Delivering high-purity, custom and bulk peptides to clients worldwide.</p></div></section>
    <section className="what-we-do section-shell"><div className="content-image"><Image src={assetPath("/images/waht-we-do-1200x800-1.webp")} alt="Peptide laboratory research" fill sizes="50vw" /></div><div><p className="eyebrow">WHAT WE DO</p>{[["Custom Peptide Synthesis","Peptides tailored to target specifications including sequence, purity and quantity."],["Bulk & Catalog Peptide Supply","A broad catalog with support for bulk procurement and repeat orders."],["End-to-End Quality Control","Controlled testing and batch documentation throughout production."]].map(([title,text])=><article key={title}><h3>{title}</h3><p>{text}</p></article>)}</div></section>
    <section className="about-products section-pad"><div className="section-shell"><p className="eyebrow">PRODUCT LINE</p><h2>Products Categories</h2><div className="about-product-grid">{products.slice(7,10).map(product=><Link href={`/peptide/${product.slug}`} key={product.slug}><Image src={product.image} alt={product.name} fill sizes="33vw"/><span>{product.name}</span></Link>)}</div></div></section>
    <section className="quality-block"><div className="quality-image"><Image src={assetPath("/images/our-commitment-to-quality-1200x800-1.webp")} alt="Leaxion quality control" fill sizes="50vw" /></div><div><p className="eyebrow light">GROW YOUR BUSINESS</p><h2>Our Commitment to Quality</h2><p>Precision, traceability and reliability guide every stage of our work.</p><ul><li>Purity Assurance</li><li>Compliance</li><li>Traceability</li><li>Reliability</li></ul></div></section>
    <section className="sales-experts section-pad"><div className="section-shell"><div className="sales-heading"><p className="eyebrow">MEET OUR TEAM</p><h2>Our Sales Experts</h2><p>Connect directly with our experienced sales team for product, documentation and order support.</p></div><div className="sales-grid">{salesExperts.map(expert=><article key={expert.name}><div className="sales-avatar" aria-hidden="true">{expert.name.charAt(0)}</div><span>SALES EXPERT</span><h3>{expert.name}</h3><a href={expert.whatsapp} target="_blank" rel="noreferrer"><WhatsAppIcon />{expert.phone}</a></article>)}</div></div></section>
    <section className="global-block section-pad"><div className="section-shell"><div><p className="eyebrow">GLOBAL PRESENCE</p><h2>Global Presence</h2><p>We support clients in more than 35 countries with tracked shipping, responsive communication and tailored logistics.</p></div><div className="global-image"><Image src={assetPath("/images/global-presence.webp")} alt="Global peptide delivery" fill sizes="45vw" /></div></div></section>
  </main><SiteFooter /></>;
}
