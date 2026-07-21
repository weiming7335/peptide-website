export type Product = { slug: string; name: string; image: string; category: string; summary: string };

export const products: Product[] = [
  ["aod9604", "AOD9604", "/images/product/AOD9604.png"], ["bpc157", "BPC157", "/images/product/BPC157.png"],
  ["bpc157-tb500", "BPC157+TB500", "/images/product/BPC157+TB500.png"], ["cagrilin", "Cagrilin", "/images/product/Cagrilin.png"],
  ["epithalon", "Epithalon", "/images/product/Epithalon.png"], ["glow", "GLOW", "/images/product/GLOW.png"],
  ["klow", "KLOW", "/images/product/KLOW.png"], ["mots-c", "MOTS-C", "/images/product/MOTS-C.png"],
  ["mt-2", "MT-2", "/images/product/MT-2.png"], ["nad-plus", "NAD+", "/images/product/NAD+.png"],
  ["reta", "Reta", "/images/product/Reta.png"], ["tb500", "TB500", "/images/product/TB500.png"],
  ["tesam", "Tesam", "/images/product/Tesam.png"], ["tirz", "Tirz", "/images/product/Tirz.png"],
].map(([slug, name, image]) => ({ slug, name, image, category: "Peptide", summary: `${name} is supplied as a high-purity research peptide with batch documentation available for qualified B2B orders.` }));

export type Certificate = { slug: string; name: string; image: string };
export const certificates: Certificate[] = [
  ["5-amino-1mq", "5-Amino-1MQ", "/images/COA/5-Amino-1MQ.jpg"], ["ahk-cu", "AHK-CU", "/images/COA/AHK-CU.jpg"],
  ["aod-9604", "AOD-9604", "/images/COA/AOD.jpg"], ["bpc-157", "BPC-157", "/images/COA/BPC-157.jpg"],
  ["cagrilintide", "Cagrilintide", "/images/COA/Cagrilintide.png"], ["epithalon", "Epithalon", "/images/COA/Epithalon-10mg-COA-Step-One-Ventures-LLC-1.26-pdf.jpg"],
  ["ghk-cu", "GHK-CU", "/images/COA/GHK-Cu.jpg"], ["glow", "GLOW", "/images/COA/Glow-Feb-OF-scaled.png"],
  ["hcg", "HCG", "/images/COA/HCG.jpg"], ["klow", "KLOW", "/images/COA/Klow.jpg"],
  ["kpv", "KPV", "/images/COA/KPV.jpg"], ["nad-plus", "NAD+", "/images/COA/NAD.jpg"],
  ["semax", "Semax", "/images/COA/Semax.png"], ["ss31", "SS31", "/images/COA/SS31.jpg"],
  ["tesamorelin", "Tesamorelin", "/images/COA/Tesamorelin.jpg"], ["tirzepatide", "Tirzepatide", "/images/COA/Tirze.jpg"],
].map(([slug, name, image]) => ({ slug, name, image }));

export type ArticleSection = { heading: string; paragraphs: string[]; points?: string[] };
export type Article = { slug: string; title: string; date: string; image: string; summary: string; sections: ArticleSection[] };
export const articles: Article[] = [
  {
    slug: "tb500-peptide-supplier", title: "TB500 Peptide Supplier: Why Leaxion Is Your Ideal Choice", date: "24 March 2026", image: "/images/blog/tb500-peptide-supplier.png",
    summary: "Selecting a TB500 supplier is a quality and supply-chain decision. Research buyers need clear specifications, batch documentation and reliable communication—not simply a low unit price.",
    sections: [
      { heading: "What Research Buyers Should Expect from a TB500 Supplier", paragraphs: ["A professional supplier should confirm the requested format, quantity, purity target and documentation before an order is accepted. These details help purchasing teams compare offers on the same basis and reduce avoidable delays."] , points: ["A clearly defined product specification", "Batch-linked analytical documentation", "Protective packaging for international transit", "A named contact for order and logistics updates"] },
      { heading: "Purity, Identity and Batch Documentation", paragraphs: ["Purity alone does not describe the complete quality profile of a research peptide. Buyers should ask how identity is assessed, whether the documentation relates to the supplied lot, and how samples are handled throughout analysis.", "Leaxion makes available Certificates of Analysis for qualified batches so research partners can review relevant information before repeat procurement."] },
      { heading: "From Trial Quantities to Repeat Supply", paragraphs: ["Research programs may begin with a small evaluation order and later require consistent repeat quantities. A suitable supplier should discuss scalability early, including expected lead times, packaging units and documentation needs at each stage."] },
      { heading: "International B2B Support", paragraphs: ["Cross-border procurement requires more than dispatching a parcel. Responsive communication, clear shipping records and prompt tracking updates help laboratories and distributors plan receiving and inventory activities."], points: ["Worldwide tracked shipping", "Custom and bulk quotation support", "PayPal, USDT, USDC, Wise and T/T options", "WhatsApp communication with the sales team"] },
      { heading: "TB500 Is for Research Use Only", paragraphs: ["Leaxion supplies TB500 strictly for laboratory research and analytical use. It is not intended for human consumption, diagnosis or treatment. Buyers are responsible for following local rules and their institution’s approved research procedures."] },
    ],
  },
  {
    slug: "research-peptide-suppliers", title: "Research Peptide Suppliers: Leaxion 7-Year Expertise", date: "20 March 2026", image: "/images/blog/research-peptide-suppliers.png",
    summary: "A dependable research peptide supplier combines manufacturing experience with transparent quality control, flexible supply options and practical support for international buyers.",
    sections: [
      { heading: "About Leaxion—Your Research Peptide Supply Partner", paragraphs: ["Leaxion supports academic laboratories, research organizations, biotechnology teams and professional distributors with catalog, custom and bulk peptide requirements. Seven years of industry experience inform how we plan specifications, documentation and customer communication."], points: ["Catalog and custom peptide supply", "Support for research and bulk quantities", "Batch documentation for qualified products", "Responsive international B2B communication"] },
      { heading: "Why Purity Matters in Research", paragraphs: ["Impurities can complicate analytical interpretation, affect repeatability and introduce uncertainty into downstream work. For this reason, buyers should establish the required purity level before requesting a quotation rather than relying on an undefined ‘high-purity’ claim.", "A Certificate of Analysis should be reviewed together with the product specification and batch identity. Research teams may also request additional documentation based on their internal quality procedures."] },
      { heading: "Catalog and Custom Peptide Services", paragraphs: ["Catalog products are useful when teams need established specifications and faster procurement. Custom projects require additional review of sequence, modification, scale, purity and analytical expectations. Providing these requirements at the inquiry stage allows the manufacturer to evaluate feasibility accurately."] },
      { heading: "How to Compare Research Peptide Suppliers", paragraphs: ["Price is only one component of total procurement cost. Rework, unclear documentation and delayed communication can cost more than the initial price difference."], points: ["Technical understanding of the requested product", "Specific and reviewable quality documentation", "Realistic production and delivery planning", "Clear payment, packaging and shipping terms", "Support after the shipment is received"] },
      { heading: "A Streamlined Ordering Process", paragraphs: ["Send Leaxion the product name or target sequence, required purity, quantity and destination through WhatsApp. Our team reviews the request, confirms available documentation and provides a tailored quotation. Order timing and logistics are agreed before payment."] },
    ],
  },
  {
    slug: "beauty-peptide-supplier", title: "Beauty Peptide Supplier: Leaxion Peptide", date: "16 March 2026", image: "/images/blog/beauty-peptide-supplier.png",
    summary: "Beauty peptide sourcing requires consistent specifications, traceable batches and close coordination between research, formulation and procurement teams.",
    sections: [
      { heading: "Peptide Supply for Cosmetic Research", paragraphs: ["Beauty and cosmetic research teams work with peptides across screening, formulation development and analytical evaluation. The supplier’s role is to deliver material that matches the agreed specification and is supported by appropriate batch information.", "Leaxion supports catalog and custom peptide inquiries for qualified research and product-development organizations."] },
      { heading: "Consistency Matters in Formulation Work", paragraphs: ["A material may be evaluated across multiple prototypes and stability studies. Consistency between research batches helps teams interpret results and plan further development with fewer variables."], points: ["Confirm purity and physical form", "Record the relevant batch number", "Review storage and packaging information", "Align repeat-order specifications with the initial evaluation"] },
      { heading: "Custom Specifications and Scale", paragraphs: ["Some programs require a standard catalog item, while others need a specific sequence, modification, purity or quantity. A detailed request enables feasibility review and prevents assumptions about what the buyer expects."] },
      { heading: "Documentation and Traceability", paragraphs: ["Professional buyers should retain quotations, specifications, Certificates of Analysis and shipping records as part of their procurement file. Traceability is particularly important when a material progresses from initial research to repeated development work."] },
      { heading: "Choosing a Long-Term Beauty Peptide Supplier", paragraphs: ["Look for a partner that responds clearly, distinguishes confirmed facts from estimates and can support both initial evaluation and repeat procurement. Leaxion combines direct WhatsApp communication with worldwide B2B supply support."] },
    ],
  },
  {
    slug: "choosing-a-peptide-manufacturer", title: "How to Choose a Reliable Peptide Manufacturer for Your Business Needs", date: "12 March 2026", image: "/images/blog/choosing-a-peptide-manufacturer.png",
    summary: "The right peptide manufacturer should be evaluated through verifiable quality information, realistic production capability, transparent commercial terms and dependable support.",
    sections: [
      { heading: "What Factors Should Businesses Review?", paragraphs: ["Choosing only by quoted price can expose a buyer to inconsistent material, incomplete documents or unreliable delivery. A structured supplier review gives procurement and research teams a clearer basis for comparison."], points: ["Quality-control methods and batch documentation", "Experience with the requested peptide or sequence", "Custom synthesis and scale-up capability", "Communication speed and technical clarity", "Packaging, shipping and after-sales support"] },
      { heading: "Quality Control You Can Verify", paragraphs: ["Ask for specific evidence rather than broad marketing claims. The supplier should explain what documentation is available, how it relates to the supplied lot and which product attributes are covered. Requirements should be agreed before ordering."] },
      { heading: "Experience, Customization and Scalability", paragraphs: ["Experience matters when a project includes difficult sequences, special specifications or repeat supply. Buyers should also confirm whether the manufacturer can move from evaluation quantities to larger orders without changing the agreed quality target."] },
      { heading: "Red Flags in Peptide Sourcing", paragraphs: ["Warning signs include pricing that cannot be explained, vague purity statements, documents that are not tied to a batch, pressure to pay before specifications are confirmed, and slow or inconsistent responses to technical questions."], points: ["Unverifiable quality claims", "No clear product specification", "Missing batch identification", "Unrealistic production or shipping promises", "Payment instructions that do not match the verified supplier contact"] },
      { heading: "Supporting International B2B Buyers", paragraphs: ["International buyers benefit from clear written quotations, agreed payment methods, appropriate packaging and traceable delivery. Leaxion supports PayPal, USDT, USDC, Wise and T/T, with current options confirmed during quotation."] },
    ],
  },
  {
    slug: "bpc157-supplier", title: "BPC157 Supplier: Why Leaxion Is Your Trusted Partner", date: "8 March 2026", image: "/images/blog/bpc157-supplier.png",
    summary: "For professional BPC157 procurement, buyers should prioritize traceable quality information, specification consistency and a supplier that can support repeat research orders.",
    sections: [
      { heading: "Evaluating a BPC157 Supplier", paragraphs: ["A supplier should be able to discuss product format, purity target, quantity, packaging and documentation before providing final commercial terms. Clear answers at this stage are a practical indicator of how the supplier will manage the order."] },
      { heading: "Batch Consistency and Analytical Records", paragraphs: ["Research buyers need documentation that can be associated with the product they receive. When reviewing a Certificate of Analysis, confirm the product name, batch reference and reported specification rather than relying on a generic example."] },
      { heading: "Packaging for Stability and Transit", paragraphs: ["Lyophilized research peptides are sealed and protected for shipment according to the order and destination. Packaging arrangements and dispatch timing should be confirmed before international delivery, particularly when the buyer has specific receiving procedures."] },
      { heading: "Support for Bulk and Repeat Procurement", paragraphs: ["Leaxion works with qualified buyers on evaluation, repeat and bulk BPC157 requirements. Sharing forecast quantities helps our team discuss availability, documentation and delivery planning more accurately."] },
      { heading: "Responsible Research Supply", paragraphs: ["BPC157 supplied by Leaxion is for laboratory research and analytical use only. We do not provide medical advice or instructions for human use. Customers must comply with applicable laws and institutional controls."] },
    ],
  },
  {
    slug: "verify-peptide-suppliers", title: "Beware of Imposters and Verify Leaxion Official Contacts", date: "4 March 2026", image: "/images/blog/verify-peptide-suppliers.png",
    summary: "Impersonation and unverified sales accounts create real risks for peptide buyers. Confirm the business contact before sharing procurement information or arranging payment.",
    sections: [
      { heading: "Why Contact Verification Matters", paragraphs: ["Unverified social accounts may reuse a company name, logo or product images without authorization. A professional-looking profile alone does not prove that the person represents Leaxion.", "Verification protects your payment, purchasing records and supply chain from avoidable fraud."] },
      { heading: "Warning Signs to Watch For", paragraphs: ["Pause the conversation when an account uses urgency, refuses to provide consistent company information or changes payment instructions without explanation."], points: ["A newly created or incomplete social profile", "Pricing far below a documented quotation", "Requests to pay an unrelated individual", "Refusal to provide product or batch documentation", "Conflicting phone numbers or business identities"] },
      { heading: "How to Verify a Leaxion Contact", paragraphs: ["Use the WhatsApp link published on this website: +852 9841 7612. Send the name and contact details of the person you are checking, and wait for confirmation before proceeding.", "Do not rely on contact details sent only through a third-party social platform. Return to the official website and start a new conversation through the displayed WhatsApp button."] },
      { heading: "What to Do If You Find an Imposter", paragraphs: ["Do not send payment or confidential purchasing information. Save screenshots, record the profile URL, report the account to the platform and notify Leaxion through the official WhatsApp number."] },
      { heading: "A Final Procurement Check", paragraphs: ["Before confirming an order, make sure the supplier identity, quotation, product specification, payment recipient and delivery details are consistent. If any item changes unexpectedly, stop and verify again."] },
    ],
  },
];

export const whatsappUrl = "https://wa.me/85298417612";
