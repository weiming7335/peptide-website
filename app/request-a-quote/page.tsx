import type { Metadata } from "next";
import { PageHero } from "@/components/page-hero";
import { QuoteForm } from "@/components/quote-form";
import { christineWhatsapp, email, lunaWhatsapp } from "@/lib/site";

export const metadata: Metadata = { title: "Request a Quote", description: "Request product, testing, packaging, brand design, website or fulfillment information from Jike Peptide." };

export default function QuotePage() {
  return <><PageHero eyebrow="PRODUCTS · SERVICES · GLOBAL SUPPORT" title="Request a quote." copy="Tell us what you need. Product pricing, current availability and project-specific service costs are confirmed privately." /><section className="section"><div className="shell quote-layout"><div><p className="eyebrow">YOUR REQUEST</p><h2>Start with the essentials.</h2><p className="quote-intro">Complete the short form below. You can add any product or service requirements in the optional inquiry details field.</p><QuoteForm /></div><aside className="contact-panel"><p className="eyebrow eyebrow-light">DIRECT CONTACT</p><h2>Prefer WhatsApp?</h2><p>Send your product list or project requirements directly to our international team.</p><a href={christineWhatsapp} target="_blank" rel="noreferrer"><span>PRIMARY WHATSAPP</span><strong>Christine · +1 213 703 8679</strong></a><a href={lunaWhatsapp} target="_blank" rel="noreferrer"><span>ALTERNATE WHATSAPP</span><strong>Luna · +852 9841 7612</strong></a><a href={`mailto:${email}`}><span>EMAIL</span><strong>{email}</strong></a><div className="contact-facts"><div><strong>1 kit</strong><span>product MOQ</span></div><div><strong>500/1,000</strong><span>custom material MOQ</span></div><div><strong>Global</strong><span>order support</span></div></div></aside></div></section></>;
}
