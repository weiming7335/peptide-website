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
  moleculeImage?: string;
};

export const productKnowledge: Record<string, ProductKnowledge> = {
  retatrutide: {
    fullName: "Retatrutide (LY3437943)",
    shortDescription:
      "A long-acting, acylated peptide engineered as a single-molecule agonist of the GIP, GLP-1 and glucagon receptors and studied in clinical metabolic research.",
    researchStatus: "Investigational clinical-stage compound · Phase 3 research",
    molecularWeight: "4,731 Da (PubChem sodium-salt record)",
    sequence: "Chemically modified peptide analogue",
    length: "39-amino-acid peptide backbone",
    origin: "Synthetic, lipidated triple-receptor agonist",
    mechanism: [
      "Retatrutide was designed to activate three related metabolic receptors—GIPR, GLP-1R and GCGR—within one peptide molecule.",
      "Randomized phase 2 studies have evaluated dose response, safety and metabolic endpoints in adults with obesity and type 2 diabetes.",
      "The TRIUMPH registrational program is evaluating retatrutide in Phase 3; it remains investigational and is not an FDA-approved medicine.",
    ],
    researchContext: [
      {
        title: "Triple-receptor pharmacology",
        body: "The defining research feature is combined agonism at GIP, GLP-1 and glucagon receptors. Published clinical papers describe the molecule as LY3437943 and evaluate the integrated response rather than treating it as a simple GLP-1 analogue.",
      },
      {
        title: "Clinical evidence stage",
        body: "Peer-reviewed phase 2 trials report outcomes in controlled study populations, while the later TRIUMPH studies are designed to establish a broader efficacy and safety evidence base. Phase 2 results are not a substitute for regulatory approval.",
      },
      {
        title: "Material versus medicine",
        body: "The catalog item is a research material. It is not an Eli Lilly product, a finished dosage form or an approved treatment. Identity, purity and quantity documentation must be tied to the specific batch being quoted.",
      },
    ],
    references: [
      {
        title: "Triple-Hormone-Receptor Agonist Retatrutide for Obesity — A Phase 2 Trial",
        journal: "New England Journal of Medicine · 2023",
        url: "https://pubmed.ncbi.nlm.nih.gov/37366315/",
      },
      {
        title: "Triple hormone receptor agonist retatrutide for metabolic dysfunction-associated steatotic liver disease",
        journal: "Nature Medicine · 2024",
        url: "https://pubmed.ncbi.nlm.nih.gov/38858523/",
      },
      {
        title: "Retatrutide sodium salt: chemical record",
        journal: "PubChem · CID 171934787",
        url: "https://pubchem.ncbi.nlm.nih.gov/compound/171934787",
      },
    ],
    faqs: [
      {
        question: "Is retatrutide an approved medicine?",
        answer:
          "No. Retatrutide remains an investigational compound in clinical development. The material listed here is supplied only for laboratory research and is not a finished drug product.",
      },
      {
        question: "What should a procurement team verify?",
        answer:
          "Confirm the requested specification, quantity, batch identifier and the analytical documents available for that exact lot before approving an order.",
      },
      {
        question: "What is included in one kit?",
        answer:
          "One sealed kit contains 10 research vials. Multiple nominal specifications are listed, subject to current stock and batch confirmation.",
      },
      {
        question: "Can labels and boxes be customized?",
        answer:
          "Yes. Private-label packaging normally requires 1–2 weeks after artwork, specification and quantity are confirmed.",
      },
    ],
  },
  tirzepatide: {
    fullName: "Tirzepatide",
    shortDescription:
      "A 39-amino-acid, lipidated peptide analogue with dual agonist activity at the GIP and GLP-1 receptors, widely characterized in pharmacology and clinical literature.",
    researchStatus: "Defined active ingredient · JP catalog material is research use only",
    molecularWeight: "4,813.45 Da",
    sequence: "Chemically modified 39-amino-acid peptide",
    length: "39 amino acids",
    origin: "Synthetic, lipidated dual-receptor agonist",
    mechanism: [
      "Tirzepatide binds and activates both the glucose-dependent insulinotropic polypeptide (GIP) receptor and the GLP-1 receptor.",
      "The lipid side chain and peptide engineering extend exposure relative to unmodified incretin peptides.",
      "FDA-approved tirzepatide medicines exist, but this catalog material is not an approved finished medicine and must not be represented as one.",
    ],
    researchContext: [
      {
        title: "Defined chemical identity",
        body: "Public chemical databases describe tirzepatide as a modified peptide with a 39-amino-acid backbone, non-natural residue substitutions and a lipid-containing side chain. A full identity specification should therefore address more than the printed nominal mass.",
      },
      {
        title: "Extensive clinical literature",
        body: "Large randomized programs have characterized tirzepatide in regulated pharmaceutical development. Those studies describe sponsor-manufactured medicines under controlled protocols, not independently sourced research vials.",
      },
      {
        title: "Procurement boundary",
        body: "For B2B research procurement, the relevant evidence is batch-linked identity, measured content, purity and any other tests explicitly shown on the report. Brand approvals cannot be transferred to a third-party research material.",
      },
    ],
    references: [
      {
        title: "Tirzepatide: compound record and chemical identifiers",
        journal: "PubChem · CID 156588324",
        url: "https://pubchem.ncbi.nlm.nih.gov/compound/Tirzepatide",
      },
      {
        title: "Tirzepatide after intensive lifestyle intervention in adults with overweight or obesity: SURMOUNT-3",
        journal: "Nature Medicine · 2023",
        url: "https://pubmed.ncbi.nlm.nih.gov/37840095/",
      },
      {
        title: "ZEPBOUND (tirzepatide) — current prescribing information",
        journal: "U.S. Food and Drug Administration · 2026",
        url: "https://www.accessdata.fda.gov/drugsatfda_docs/label/2026/217806s042lbl.pdf",
      },
    ],
    faqs: [
      {
        question: "Is this Zepbound or Mounjaro?",
        answer:
          "No. Those are regulated finished medicines from their respective authorization holder. The JP catalog item is an independent research material and is not sold or represented as either brand.",
      },
      {
        question: "Which documents should be requested?",
        answer:
          "Ask for the reports tied to the available batch. A report should identify the sample or batch and state exactly which tests and measured results it covers.",
      },
      {
        question: "What is included in one kit?",
        answer:
          "The standard catalog presentation is 10 research vials per sealed kit. Available specifications and volume pricing should be confirmed in the quotation.",
      },
      {
        question: "Is the material for human use?",
        answer:
          "No. JP catalog material is labeled Research Use Only and Not for Human Consumption.",
      },
    ],
  },
  "bpc-157": {
    fullName: "Body Protection Compound 157 (BPC-157)",
    shortDescription:
      "A synthetic 15-amino-acid peptide investigated primarily in cellular and animal models involving tissue response, angiogenic signaling and gastrointestinal protection.",
    researchStatus: "Experimental compound · predominantly preclinical evidence",
    molecularWeight: "1,419.5 Da",
    sequence: "GEPPPGKPADDAGLV",
    length: "15 amino acids",
    origin: "Synthetic pentadecapeptide",
    mechanism: [
      "Preclinical publications have examined BPC-157 in relation to endothelial signaling, nitric-oxide pathways and cellular responses associated with tissue repair.",
      "Musculoskeletal, gastrointestinal and vascular findings are drawn mainly from animal and in-vitro models.",
      "Human evidence is extremely limited; no validated clinical use, standardized therapeutic dose or approved formulation is established.",
    ],
    researchContext: [
      {
        title: "Sequence-defined peptide",
        body: "PubChem lists BPC-157 as the pentadecapeptide Gly–Glu–Pro–Pro–Pro–Gly–Lys–Pro–Ala–Asp–Asp–Ala–Gly–Leu–Val, with molecular formula C62H98N16O22.",
      },
      {
        title: "Preclinical research concentration",
        body: "The literature contains numerous proposed pathways and animal findings, but independent replication and well-controlled human studies remain limited. Mechanistic hypotheses should not be converted into clinical claims.",
      },
      {
        title: "Evidence boundary",
        body: "Recent reviews explicitly describe a substantial gap between preclinical interest and human evidence. This page therefore presents identity and research context, not treatment, dosing or safety guidance.",
      },
    ],
    references: [
      {
        title: "BPC-157: compound record, sequence and computed properties",
        journal: "PubChem · CID 9941957",
        url: "https://pubchem.ncbi.nlm.nih.gov/compound/9941957",
      },
      {
        title: "BPC 157 and standard growth factors: gastrointestinal tract, skin and muscle healing",
        journal: "Current Pharmaceutical Design · 2018",
        url: "https://pubmed.ncbi.nlm.nih.gov/30915550/",
      },
      {
        title: "Regeneration or Risk? A Narrative Review of BPC-157 for Musculoskeletal Healing",
        journal: "Current Reviews in Musculoskeletal Medicine · 2025",
        url: "https://pubmed.ncbi.nlm.nih.gov/40789979/",
      },
    ],
    faqs: [
      {
        question: "How strong is the human evidence for BPC-157?",
        answer:
          "It is very limited. Most published findings are preclinical, and they do not establish an approved use, clinical efficacy, safety or dosing.",
      },
      {
        question: "What sequence should identity testing match?",
        answer:
          "The public database sequence is GEPPPGKPADDAGLV, a 15-amino-acid peptide with a computed molecular weight of about 1,419.5 Da.",
      },
      {
        question: "Does literature count as a COA?",
        answer:
          "No. Literature describes research on a compound. A COA or third-party report documents tests performed on an identified sample or batch.",
      },
      {
        question: "What is the standard presentation?",
        answer:
          "One sealed kit contains 10 research vials. Confirm specification, available lot and documentation with Christine.",
      },
    ],
  },
  "ghk-cu": {
    fullName: "Copper tripeptide GHK-Cu",
    shortDescription:
      "A coordination complex of copper(II) with the tripeptide glycyl-L-histidyl-L-lysine, studied in extracellular-matrix, fibroblast and tissue-response models.",
    researchStatus: "Experimental research material · primarily preclinical evidence",
    molecularWeight: "400.90 Da (PubChem 1:1 complex record)",
    sequence: "Gly–His–Lys coordinated with Cu(II)",
    length: "3-amino-acid ligand",
    origin: "Synthetic copper–peptide coordination complex",
    mechanism: [
      "GHK provides a high-affinity tripeptide ligand for copper, creating a biologically studied coordination complex rather than an unmodified peptide alone.",
      "Cell studies have examined extracellular-matrix remodeling signals, including MMP-2 and tissue inhibitors of metalloproteinases in fibroblast cultures.",
      "Animal wound models and formulated delivery systems provide preclinical evidence, but do not establish a general clinical indication for research-grade material.",
    ],
    researchContext: [
      {
        title: "Coordination chemistry matters",
        body: "Reported molecular mass depends on the chemical record and complex stoichiometry. This page uses PubChem's 1:1 copper-tripeptide record; procurement documents should state the tested identity and measured copper/peptide content where applicable.",
      },
      {
        title: "Matrix-remodeling models",
        body: "Primary fibroblast research reported changes in MMP-2, TIMP-1 and TIMP-2, while earlier rat wound-chamber experiments measured connective-tissue components after local experimental exposure.",
      },
      {
        title: "Claim boundary",
        body: "These findings come largely from cell and animal research. They do not validate cosmetic or therapeutic outcomes for a supplied batch and should not be used as dosing or treatment guidance.",
      },
    ],
    references: [
      {
        title: "Copper tripeptide: compound record and computed descriptors",
        journal: "PubChem · CID 139035031",
        url: "https://pubchem.ncbi.nlm.nih.gov/compound/139035031",
      },
      {
        title: "GHK-Cu stimulates matrix metalloproteinase-2 expression by fibroblast cultures",
        journal: "Life Sciences · 2000",
        url: "https://pubmed.ncbi.nlm.nih.gov/11045606/",
      },
      {
        title: "In vivo stimulation of connective tissue accumulation by GHK-Cu in rat experimental wounds",
        journal: "Journal of Clinical Investigation · 1993",
        url: "https://pubmed.ncbi.nlm.nih.gov/8227353/",
      },
    ],
    faqs: [
      {
        question: "Is GHK-Cu the same as the free GHK peptide?",
        answer:
          "No. GHK-Cu is a copper coordination complex of the GHK tripeptide. Chemical identity and measured content should reflect the complex being supplied.",
      },
      {
        question: "Why can molecular weights differ between sources?",
        answer:
          "Records may use different protonation states, salts or coordination stoichiometries. The cited 400.90 Da value is PubChem's 1:1 complex record.",
      },
      {
        question: "Are research findings proof of batch quality?",
        answer:
          "No. Published studies provide biological context. Batch quality must be supported separately by sample-specific analytical documentation.",
      },
      {
        question: "What is included in one kit?",
        answer:
          "One sealed kit contains 10 research vials. Confirm current specification, color/appearance expectations and batch documents before procurement.",
      },
    ],
  },
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
