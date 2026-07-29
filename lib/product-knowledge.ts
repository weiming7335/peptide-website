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
