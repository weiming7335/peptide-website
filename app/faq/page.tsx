import { PageHero } from "@/components/page-hero";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

const questions = [
  ["What types of peptides do you manufacture?", "We specialize in custom peptides, research-grade peptides, cosmetic peptides, lyophilized powders and raw materials for pharmaceutical research applications."],
  ["What is the typical purity of your peptides?", "Our peptides are typically ≥99% pure, with detailed Certificates of Analysis available for qualified batches."],
  ["Why do your products say “Research Use Only”?", "Products are supplied exclusively for laboratory research and analytical use. They are not intended for human consumption, diagnosis or treatment."],
  ["What if I need technical support after purchasing?", "Our technical and sales support team can answer questions before or after purchase through WhatsApp."],
  ["How do you reconstitute powdered peptides?", "Our products are supplied for qualified laboratory research only. Follow your institution’s validated protocol and applicable safety requirements."],
  ["How is the product packaged to ensure stability?", "Peptides are lyophilized and sealed in vials, with protective packaging selected according to the destination and climate."],
  ["Do you ship internationally?", "Yes. We support delivery to more than 35 countries and provide shipment tracking."],
  ["Where are you shipping from?", "International parcels are consolidated through our export logistics network before worldwide delivery."],
  ["What payment methods do you accept?", "Available secure payment methods are confirmed by our sales specialist during quotation."],
  ["How long does it take to process and ship my order?", "Standard and custom lead times depend on product availability, quantity and specification. The schedule is confirmed before ordering."],
];

export default function FaqPage() {
  return <><SiteHeader /><main><PageHero title="FAQ" /><section className="faq-page section-pad"><div className="section-shell"><div><p className="eyebrow">OUR RESOURCES</p><h2>Frequently Asked Questions</h2><p>Answers about products, documentation, packaging and global service.</p></div><div className="faq-list">{questions.map(([q, a], i) => <details key={q} open={i === 0}><summary>{q}<span>+</span></summary><p>{a}</p></details>)}</div></div></section></main><SiteFooter /></>;
}
