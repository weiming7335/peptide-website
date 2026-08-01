import { PageHero } from "@/components/page-hero";
import { QuoteForm } from "@/components/quote-form";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { christineWhatsapp, email, lunaWhatsapp, whatsappChannel } from "@/lib/content";

export default function ContactPage(){return <><SiteHeader/><main><PageHero title="Request a Procurement Quote"/><section className="section-pad contact-page"><div className="section-shell quote-layout">
  <div><p className="eyebrow">B2B PROCUREMENT INQUIRY</p><h2>Tell us what you need.</h2><p className="quote-intro">Submit product specifications, estimated quantities and documentation requirements. Christine will confirm availability, volume pricing and the records available for the quoted batch.</p><QuoteForm/></div>
  <aside className="quote-contact-panel">
    <p className="eyebrow">DIRECT CONTACT</p><h2>Jike Peptide Team</h2>
    <div className="quote-facts"><div><span>STANDARD PRESENTATION</span><strong>10 vials / kit</strong></div><div><span>EVALUATION MOQ</span><strong>1 kit</strong></div><div><span>PRIVATE LABEL</span><strong>Normally 1–2 weeks</strong></div></div>
    <div className="quote-contact-links"><a href={christineWhatsapp} target="_blank" rel="noreferrer"><span>PRIMARY WHATSAPP</span><strong>Christine · +1 213 703 8679</strong></a><a href={lunaWhatsapp} target="_blank" rel="noreferrer"><span>ALTERNATE WHATSAPP</span><strong>Luna · +852 9841 7612</strong></a><a href={`mailto:${email}`}><span>EMAIL</span><strong>{email}</strong></a><a href={whatsappChannel} target="_blank" rel="noreferrer"><span>UPDATES</span><strong>WhatsApp Channel</strong></a></div>
    <p className="quote-boundary">Catalog materials are supplied for laboratory research only and are not intended for human consumption. Documentation must be confirmed against the batch being quoted.</p>
  </aside>
</div></section></main><SiteFooter/></>;}
