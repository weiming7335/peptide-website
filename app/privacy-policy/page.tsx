import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Privacy Policy", description: "Privacy policy for Jike Peptide B2B procurement inquiries." };

export default function PrivacyPage() {
  return <main className="landing-legal"><Link href="/">← Back to Jike Peptide</Link><p className="eyebrow">PRIVACY</p><h1>Privacy policy</h1><p>Last updated: August 1, 2026</p>
    <h2>Information we receive</h2><p>When you submit a procurement inquiry or contact us through WhatsApp or email, you may provide your name, company, business contact details, target market, sourcing requirements and other information you choose to include.</p>
    <h2>How we use information</h2><p>Jike Biotech (Guangzhou) Co., Ltd. uses this information to review business inquiries, verify buyer and end-use information, prepare quotations, coordinate documentation and respond to your request.</p>
    <h2>Service providers</h2><p>Inquiry data may be processed by Formspree, WhatsApp, email providers and other service providers needed to respond to you. Those providers process information under their own terms and privacy policies.</p>
    <h2>Advertising and measurement</h2><p>We use Google Ads and Reddit measurement technologies to understand visits and inquiry-related actions. These providers may process device, browser and interaction information under their own privacy terms and advertising controls.</p>
    <h2>Retention and choices</h2><p>We retain inquiry information only as reasonably necessary for business, compliance and recordkeeping purposes. You may request access, correction or deletion, subject to applicable legal requirements.</p>
    <h2>Contact</h2><p>Privacy questions may be sent to <a href="mailto:christinepeptide@gmail.com">christinepeptide@gmail.com</a>.</p>
  </main>;
}
