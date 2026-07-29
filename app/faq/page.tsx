import { PageHero } from "@/components/page-hero";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { christineWhatsapp } from "@/lib/content";

const faqs=[
  ["What is the minimum order?","The standard minimum order is one kit. Each standard kit contains 10 vials. Individual vials are not sold."],
  ["Are prices shown on the website?","No. Current retail, wholesale and custom prices are provided directly by Christine because specifications, quantities and delivery requirements vary."],
  ["Can I review a COA before ordering?","Yes. Public third-party links are available in our COA center. Contact us to confirm the documentation for the current batch."],
  ["How long does U.S. delivery take?","USPS normally takes 10–15 business days after dispatch and costs $50. FedEx normally takes 4–7 business days after dispatch and costs $80. Carrier transit times may vary."],
  ["Do you offer free shipping?","Orders of $500 or more include complimentary USPS shipping. FedEx is available for an additional $30 on qualifying orders."],
  ["Do you ship internationally?","Yes. We support worldwide delivery. Available routes and timing are confirmed for the destination during quotation."],
  ["Which payment methods are accepted?","Wire T/T, PayPal with a 5% transaction fee, Zelle, USDC, USDT-TRC20 and USDT-ERC20. Payment instructions are shared only through verified business contacts."],
  ["Can you provide custom labels and packaging?","Yes. Custom label and packaging projects normally require 1–2 weeks. MOQ depends on the product and packaging requirements."],
  ["Are these products intended for human consumption?","No. All catalog products are supplied strictly for laboratory research and analytical use and are not for human consumption."],
  ["How do I verify an official contact?","Use the Christine WhatsApp button or email address published on this website. Do not make payment to contact details received only through an unverified third-party account."],
];
export default function FaqPage(){return <><SiteHeader/><main><PageHero title="Frequently asked questions"/><section className="section-pad"><div className="section-shell faq-layout"><div><p className="eyebrow">HELP CENTER</p><h2>Clear answers before you order.</h2><p>Need a product-specific answer? Contact Christine directly.</p><a className="primary-button" href={christineWhatsapp} target="_blank" rel="noreferrer">Ask on WhatsApp</a></div><div className="faq-list">{faqs.map(([q,a])=><details key={q}><summary>{q}<span>+</span></summary><p>{a}</p></details>)}</div></div></section></main><SiteFooter/></>;}
