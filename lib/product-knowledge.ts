export type ProductKnowledge = {
  fullName: string;
  shortDescription: string;
  researchStatus: string;
  molecularWeight: string;
  sequence: string;
  length: string;
  origin: string;
  mechanism: string[];
  researchContext: { title: string; body: string }[];
  references: { title: string; journal: string; url: string }[];
  faqs: { question: string; answer: string }[];
  moleculeImage: string;
};

export const productKnowledge: Record<string, ProductKnowledge> = {
  cartalax: {
    fullName: "L-alanyl-L-glutamyl-L-aspartic acid",
    shortDescription:
      "A sequence-defined tripeptide, Ala–Glu–Asp (AED), used in laboratory studies of short-peptide signaling and chondrogenic cell differentiation.",
    researchStatus: "Experimental research compound · limited preclinical evidence",
    molecularWeight: "333.29 Da",
    sequence: "AED (Ala–Glu–Asp)",
    length: "3 amino acids",
    origin: "Synthetic, sequence-defined tripeptide",
    mechanism: [
      "Public chemical records identify Cartalax as the acidic tripeptide AED, not the four-amino-acid sequence AEDP.",
      "Cell-culture studies have examined AED in relation to expression of chondrogenic differentiation markers, including SOX9, aggrecan and type II collagen.",
      "The published evidence is early-stage and does not establish clinical efficacy, a validated therapeutic mechanism or an approved human use.",
    ],
    researchContext: [
      {
        title: "Sequence identity",
        body: "PubChem records Cartalax (T-31) as Ala–Glu–Asp with molecular formula C12H19N3O8 and computed molecular weight 333.29 Da. Supplier literature that labels Cartalax as AEDP conflicts with this database record.",
      },
      {
        title: "Chondrogenic cell models",
        body: "Published in-vitro work has studied AED in aging human mesenchymal stem-cell cultures and measured gene expression and protein synthesis associated with chondrogenic differentiation.",
      },
      {
        title: "Evidence boundary",
        body: "These observations are laboratory findings. They should not be presented as proof of cartilage repair, clinical benefit, safety or suitability for human use.",
      },
    ],
    references: [
      {
        title: "Cartalax (T-31 peptide): compound record and computed chemical descriptors",
        journal: "PubChem · CID 87815447",
        url: "https://pubchem.ncbi.nlm.nih.gov/compound/87815447",
      },
      {
        title: "Peptide Regulation of Chondrogenic Stem Cell Differentiation",
        journal: "International Journal of Molecular Sciences · 2023",
        url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC10179481/",
      },
      {
        title: "The influence of peptides on the chondrogenic differentiation of human mesenchymal stem cells during replicative aging",
        journal: "Advances in Gerontology · 2023",
        url: "https://pubmed.ncbi.nlm.nih.gov/37782646/",
      },
    ],
    faqs: [
      {
        question: "What sequence is listed for Cartalax?",
        answer:
          "The public PubChem record identifies Cartalax as the tripeptide AED (Ala–Glu–Asp). It should not be confused with AEDP, which is a different four-amino-acid peptide.",
      },
      {
        question: "Is Cartalax an approved therapeutic product?",
        answer:
          "No. It is presented here solely as a laboratory research material and is not for human consumption, diagnosis or treatment.",
      },
      {
        question: "What is included in one kit?",
        answer:
          "The catalog specification is 20 mg per vial, with 10 research vials in one sealed kit. Confirm current availability before procurement.",
      },
      {
        question: "Can current-batch documentation be requested?",
        answer:
          "Yes. Documentation availability is batch-specific. Christine will confirm what is available for the quoted lot before order approval.",
      },
    ],
    moleculeImage: "/images/product-knowledge/cartalax.svg",
  },
  "mots-c": {
    fullName: "Mitochondrial Open Reading Frame of the 12S rRNA-c",
    shortDescription:
      "A 16-amino-acid, mitochondria-derived peptide studied as a signaling link between mitochondrial and nuclear responses to metabolic stress.",
    researchStatus: "Experimental research compound · preclinical evidence",
    molecularWeight: "2,175 Da",
    sequence: "MRWQEMGYIFYPRKLR",
    length: "16 amino acids",
    origin: "Encoded within the mitochondrial 12S rRNA region",
    mechanism: [
      "Published cellular and animal research links MOTS-c to AMPK-dependent metabolic signaling.",
      "Under metabolic stress, MOTS-c has been observed to translocate to the nucleus and influence stress-response gene expression.",
      "Exercise-related studies have examined endogenous MOTS-c expression in skeletal muscle and circulation.",
    ],
    researchContext: [
      {
        title: "Metabolic homeostasis",
        body: "The original discovery study identified MOTS-c as a mitochondrial-encoded signaling peptide and examined glucose, mitochondrial and fatty-acid metabolism in cellular and mouse models.",
      },
      {
        title: "Stress-response signaling",
        body: "Subsequent work reported AMPK-dependent nuclear translocation under metabolic stress, supporting a mitochondria-to-nucleus signaling role.",
      },
      {
        title: "Exercise and aging models",
        body: "Research in mice and a small human exercise cohort examined endogenous MOTS-c responses to exercise and age-related physical decline. These findings are investigational and are not evidence of an approved human use.",
      },
    ],
    references: [
      {
        title: "The mitochondrial-derived peptide MOTS-c promotes metabolic homeostasis and reduces obesity and insulin resistance",
        journal: "Cell Metabolism · 2015",
        url: "https://pubmed.ncbi.nlm.nih.gov/25738459/",
      },
      {
        title: "The Mitochondrial-Encoded Peptide MOTS-c Translocates to the Nucleus to Regulate Nuclear Gene Expression in Response to Metabolic Stress",
        journal: "Cell Metabolism · 2018",
        url: "https://pubmed.ncbi.nlm.nih.gov/29983246/",
      },
      {
        title: "MOTS-c is an exercise-induced mitochondrial-encoded regulator of age-dependent physical decline and muscle homeostasis",
        journal: "Nature Communications · 2021",
        url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC7817689/",
      },
    ],
    faqs: [
      {
        question: "Is MOTS-C approved for human use?",
        answer:
          "No. The material offered here is for laboratory research only and is not for human consumption, diagnosis or treatment.",
      },
      {
        question: "What is included in one kit?",
        answer:
          "One sealed kit contains 10 research vials. Available specifications and current stock should be confirmed before ordering.",
      },
      {
        question: "Can I review the current batch report?",
        answer:
          "Yes. Published reports are shown on this page, and Christine can confirm the report linked to the currently available batch before payment.",
      },
      {
        question: "Can the label and box be customized?",
        answer:
          "Yes. Private-label and custom packaging projects are supported, normally with a 1–2 week preparation window after artwork confirmation.",
      },
    ],
    moleculeImage: "/images/product-knowledge/mots-c.png",
  },
};
