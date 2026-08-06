// Structured from the 42 source PDFs supplied in 产品详情.zip.

export type ProductDetails = {
  form: string;
  appearance: string;
  casNumber?: string | null;
  sequence?: string | null;
  activeComponents?: string | null;
  proteinStructure?: string | null;
  packaging: string;
  intendedUse: string;
  storage: { lyophilized: string; reconstituted: string };
};

export const productDetails: Record<string, ProductDetails> = {
  "5-Amino-1MQ": {
    "form": "Lyophilized material / powder",
    "appearance": "White to off-white lyophilized material.",
    "casNumber": "42464-96-0",
    "sequence": null,
    "activeComponents": null,
    "proteinStructure": null,
    "packaging": "10 sealed vials per kit",
    "intendedUse": "Laboratory research use only",
    "storage": {
      "lyophilized": "Store at -20°C in a sealed container protected from moisture.",
      "reconstituted": "Prepare solutions fresh where possible. For longer storage, use single-use frozen aliquots and avoid repeated freeze-thaw cycles."
    }
  },
  "AHK-Cu": {
    "form": "Lyophilized powder",
    "appearance": "Light blue to blue lyophilized material.",
    "casNumber": "767286-83-9",
    "sequence": "Ala-His-Lys copper(II) complex.",
    "activeComponents": null,
    "proteinStructure": null,
    "packaging": "10 sealed vials per kit",
    "intendedUse": "Laboratory research use only",
    "storage": {
      "lyophilized": "Store at -20°C, sealed and protected from moisture.",
      "reconstituted": "Aliquot prepared solutions and store frozen at -20°C or -80°C. Avoid repeated freeze-thaw cycles."
    }
  },
  "AICAR": {
    "form": "Lyophilized material / powder",
    "appearance": "Powder; typically tan, with lot-specific shade.",
    "casNumber": "2627-69-2",
    "sequence": null,
    "activeComponents": null,
    "proteinStructure": null,
    "packaging": "10 sealed vials per kit",
    "intendedUse": "Laboratory research use only",
    "storage": {
      "lyophilized": "Store at -20°C in a tightly sealed, dry container.",
      "reconstituted": "Prepare solutions fresh whenever possible. If storage is required, use single-use aliquots at -20°C. Avoid repeated freeze-thaw cycles."
    }
  },
  "AOD-9604": {
    "form": "Lyophilized powder",
    "appearance": "White to off-white lyophilized powder.",
    "casNumber": "221231-10-3",
    "sequence": "Tyr-Leu-Arg-Ile-Val-Gln-Cys-Arg-Ser-Val-Glu-Gly-Ser-Cys-Gly-Phe; intramolecular disulfide bridge between Cys7 and Cys14.",
    "activeComponents": null,
    "proteinStructure": null,
    "packaging": "10 sealed vials per kit",
    "intendedUse": "Laboratory research use only",
    "storage": {
      "lyophilized": "Store at -20°C in a tightly sealed vial, protected from light and moisture. Allow the sealed vial to reach room temperature before opening.",
      "reconstituted": "For short-term laboratory handling, keep at 2-8°C. For longer storage, aliquot and freeze at <=-20°C when the experimental buffer is compatible. Avoid repeated freeze-thaw cycles."
    }
  },
  "ARA-290": {
    "form": "Lyophilized powder",
    "appearance": "White to off-white lyophilized powder.",
    "casNumber": "1208243-50-8",
    "sequence": "pGlu-Glu-Gln-Leu-Glu-Arg-Ala-Leu-Asn-Ser-Ser-OH.",
    "activeComponents": null,
    "proteinStructure": null,
    "packaging": "10 sealed vials per kit",
    "intendedUse": "Laboratory research use only",
    "storage": {
      "lyophilized": "Store at -20°C in a tightly sealed vial, protected from light and moisture. Allow the sealed vial to reach room temperature before opening.",
      "reconstituted": "For short-term laboratory handling, keep at 2-8°C. For longer storage, aliquot and freeze at <=-20°C when the experimental buffer is compatible. Avoid repeated freeze-thaw cycles."
    }
  },
  "Adamax": {
    "form": "Lyophilized powder",
    "appearance": "Lyophilized powder; color is lot-specific.",
    "casNumber": null,
    "sequence": null,
    "activeComponents": null,
    "proteinStructure": null,
    "packaging": "10 sealed vials per kit",
    "intendedUse": "Laboratory research use only",
    "storage": {
      "lyophilized": "Store at -20°C in a tightly sealed vial, protected from light and moisture. Allow the sealed vial to reach room temperature before opening.",
      "reconstituted": "For short-term laboratory handling, keep at 2-8°C. For longer storage, aliquot and freeze at <=-20°C when the experimental buffer is compatible. Avoid repeated freeze-thaw cycles."
    }
  },
  "BPC-157 + TB-500": {
    "form": "Lyophilized powder",
    "appearance": "White to off-white lyophilized powder.",
    "casNumber": null,
    "sequence": null,
    "activeComponents": "BPC-157 + thymosin beta-4 (marketed as TB-500). See the individual component identities.",
    "proteinStructure": null,
    "packaging": "10 sealed vials per kit",
    "intendedUse": "Laboratory research use only",
    "storage": {
      "lyophilized": "Store at -20°C in a tightly sealed vial, protected from light and moisture. Allow the sealed vial to reach room temperature before opening.",
      "reconstituted": "For short-term laboratory handling, keep at 2-8°C. For longer storage, aliquot and freeze at <=-20°C when the experimental buffer is compatible. Avoid repeated freeze-thaw cycles."
    }
  },
  "BPC-157": {
    "form": "Lyophilized powder",
    "appearance": "White to off-white lyophilized powder.",
    "casNumber": "137525-51-0",
    "sequence": "Gly-Glu-Pro-Pro-Pro-Gly-Lys-Pro-Ala-Asp-Asp-Ala-Gly-Leu-Val.",
    "activeComponents": null,
    "proteinStructure": null,
    "packaging": "10 sealed vials per kit",
    "intendedUse": "Laboratory research use only",
    "storage": {
      "lyophilized": "Store at -20°C in a tightly sealed vial, protected from light and moisture. Allow the sealed vial to reach room temperature before opening.",
      "reconstituted": "For short-term laboratory handling, keep at 2-8°C. For longer storage, aliquot and freeze at <=-20°C when the experimental buffer is compatible. Avoid repeated freeze-thaw cycles."
    }
  },
  "CJC-1295 (with DAC)": {
    "form": "Lyophilized powder",
    "appearance": "White to off-white lyophilized powder.",
    "casNumber": "446262-90-4",
    "sequence": "Tyr-D-Ala-Asp-Ala-Ile-Phe-Thr-Gln-Ser-Tyr-Arg-Lys-Val-Leu-Ala-Gln-Leu-Ser-Ala-Arg-Lys-Leu-Leu-Gln-Asp-Ile-Leu-Ser-Arg-Lys(Maleimidopropionyl)-NH2.",
    "activeComponents": null,
    "proteinStructure": null,
    "packaging": "10 sealed vials per kit",
    "intendedUse": "Laboratory research use only",
    "storage": {
      "lyophilized": "Store at -20°C in a tightly sealed vial, protected from light and moisture. Allow the sealed vial to reach room temperature before opening.",
      "reconstituted": "For short-term laboratory handling, keep at 2-8°C. For longer storage, aliquot and freeze at <=-20°C when the experimental buffer is compatible. Avoid repeated freeze-thaw cycles."
    }
  },
  "CJC-1295 (without DAC) + Ipamorelin": {
    "form": "Lyophilized powder",
    "appearance": "White to off-white lyophilized powder.",
    "casNumber": null,
    "sequence": null,
    "activeComponents": "CJC-1295 without DAC (Modified GRF 1-29) + ipamorelin.",
    "proteinStructure": null,
    "packaging": "10 sealed vials per kit",
    "intendedUse": "Laboratory research use only",
    "storage": {
      "lyophilized": "Store at -20°C in a tightly sealed vial, protected from light and moisture. Allow the sealed vial to reach room temperature before opening.",
      "reconstituted": "For short-term laboratory handling, keep at 2-8°C. For longer storage, aliquot and freeze at <=-20°C when the experimental buffer is compatible. Avoid repeated freeze-thaw cycles."
    }
  },
  "CJC-1295 (without DAC)": {
    "form": "Lyophilized powder",
    "appearance": "White to off-white lyophilized powder.",
    "casNumber": "446036-97-1",
    "sequence": "Tyr-D-Ala-Asp-Ala-Ile-Phe-Thr-Gln-Ser-Tyr-Arg-Lys-Val-Leu-Ala-Gln-Leu-Ser-Ala-Arg-Lys-Leu-Leu-Gln-Asp-Ile-Leu-Ser-Arg-NH2.",
    "activeComponents": null,
    "proteinStructure": null,
    "packaging": "10 sealed vials per kit",
    "intendedUse": "Laboratory research use only",
    "storage": {
      "lyophilized": "Store at -20°C in a tightly sealed vial, protected from light and moisture. Allow the sealed vial to reach room temperature before opening.",
      "reconstituted": "For short-term laboratory handling, keep at 2-8°C. For longer storage, aliquot and freeze at <=-20°C when the experimental buffer is compatible. Avoid repeated freeze-thaw cycles."
    }
  },
  "Cagrilintide": {
    "form": "Lyophilized powder",
    "appearance": "White lyophilized powder.",
    "casNumber": "1415456-99-3",
    "sequence": "Eicosanedioic acid-gamma-Glu-Lys-Cys-Asn-Thr-Ala-Thr-Cys-Ala-Thr-Gln-Arg-Leu-Ala-Glu-Phe-Leu-Arg-His-Ser-Ser-Asn-Asn-Phe-Gly-Pro-Ile-Leu-Pro-Pro-Thr-Asn-Val-Gly-Ser-Asn-Thr-Pro-NH2; disulfide bridge Cys2-Cys7.",
    "activeComponents": null,
    "proteinStructure": null,
    "packaging": "10 sealed vials per kit",
    "intendedUse": "Laboratory research use only",
    "storage": {
      "lyophilized": "Store at -20°C in a tightly sealed vial, protected from light and moisture. Allow the sealed vial to reach room temperature before opening.",
      "reconstituted": "For short-term laboratory handling, keep at 2-8°C. For longer storage, aliquot and freeze at <=-20°C when the experimental buffer is compatible. Avoid repeated freeze-thaw cycles."
    }
  },
  "Cartalax": {
    "form": "Lyophilized powder",
    "appearance": "Lyophilized powder; color is lot-specific.",
    "casNumber": null,
    "sequence": "Ala-Glu-Asp (AED).",
    "activeComponents": null,
    "proteinStructure": null,
    "packaging": "10 sealed vials per kit",
    "intendedUse": "Laboratory research use only",
    "storage": {
      "lyophilized": "Store at -20°C in a tightly sealed vial, protected from light and moisture. Allow the sealed vial to reach room temperature before opening.",
      "reconstituted": "For short-term laboratory handling, keep at 2-8°C. For longer storage, aliquot and freeze at <=-20°C when the experimental buffer is compatible. Avoid repeated freeze-thaw cycles."
    }
  },
  "DSIP": {
    "form": "Lyophilized powder",
    "appearance": "White to off-white lyophilized powder.",
    "casNumber": "62568-57-4",
    "sequence": "Trp-Ala-Gly-Gly-Asp-Ala-Ser-Gly-Glu-OH.",
    "activeComponents": null,
    "proteinStructure": null,
    "packaging": "10 sealed vials per kit",
    "intendedUse": "Laboratory research use only",
    "storage": {
      "lyophilized": "Store at -20°C in a tightly sealed vial, protected from light and moisture. Allow the sealed vial to reach room temperature before opening.",
      "reconstituted": "For short-term laboratory handling, keep at 2-8°C. For longer storage, aliquot and freeze at <=-20°C when the experimental buffer is compatible. Avoid repeated freeze-thaw cycles."
    }
  },
  "Epitalon": {
    "form": "Lyophilized powder",
    "appearance": "White to off-white lyophilized powder.",
    "casNumber": "307297-39-8",
    "sequence": "Ala-Glu-Asp-Gly.",
    "activeComponents": null,
    "proteinStructure": null,
    "packaging": "10 sealed vials per kit",
    "intendedUse": "Laboratory research use only",
    "storage": {
      "lyophilized": "Store at -20°C in a tightly sealed vial, protected from light and moisture. Allow the sealed vial to reach room temperature before opening.",
      "reconstituted": "For short-term laboratory handling, keep at 2-8°C. For longer storage, aliquot and freeze at <=-20°C when the experimental buffer is compatible. Avoid repeated freeze-thaw cycles."
    }
  },
  "GHK-Cu": {
    "form": "Lyophilized powder",
    "appearance": "Blue to purple lyophilized material.",
    "casNumber": "89030-95-5",
    "sequence": "Gly-His-Lys copper(II) complex.",
    "activeComponents": null,
    "proteinStructure": null,
    "packaging": "10 sealed vials per kit",
    "intendedUse": "Laboratory research use only",
    "storage": {
      "lyophilized": "Store at -20°C, sealed, dry, and protected from light.",
      "reconstituted": "Aliquot prepared solutions and store frozen at -20°C or -80°C. Avoid repeated freeze-thaw cycles."
    }
  },
  "GLOW": {
    "form": "Lyophilized powder",
    "appearance": "Blue to blue-green lyophilized material; shade may vary with formulation.",
    "casNumber": null,
    "sequence": null,
    "activeComponents": "BPC-157 10 mg + GHK-Cu 50 mg + thymosin beta-4 (TB-500) 10 mg per vial.",
    "proteinStructure": null,
    "packaging": "10 sealed vials per kit",
    "intendedUse": "Laboratory research use only",
    "storage": {
      "lyophilized": "Store at -20°C in a tightly sealed vial, protected from light and moisture. Allow the sealed vial to reach room temperature before opening.",
      "reconstituted": "For short-term laboratory handling, keep at 2-8°C. For longer storage, aliquot and freeze at <=-20°C when the experimental buffer is compatible. Avoid repeated freeze-thaw cycles."
    }
  },
  "Glutathione": {
    "form": "Lyophilized material / powder",
    "appearance": "White powder or white lyophilized material.",
    "casNumber": "70-18-8",
    "sequence": "gamma-Glu-Cys-Gly (reduced glutathione).",
    "activeComponents": null,
    "proteinStructure": null,
    "packaging": "10 sealed vials per kit",
    "intendedUse": "Laboratory research use only",
    "storage": {
      "lyophilized": "Store at 2-8°C in a tightly sealed, dry container protected from light.",
      "reconstituted": "Prepare solutions fresh whenever possible. If temporarily retained, keep at 2-8°C and use promptly."
    }
  },
  "HCG": {
    "form": "Sterile dried/lyophilized protein material",
    "appearance": "White dry powder or cake.",
    "casNumber": "9002-61-3",
    "sequence": null,
    "activeComponents": null,
    "proteinStructure": "Heterodimeric glycoprotein: alpha subunit (92 amino acids) and beta subunit (145 amino acids); glycosylation is heterogeneous.",
    "packaging": "10 sealed vials per kit",
    "intendedUse": "Laboratory research use only",
    "storage": {
      "lyophilized": "For the research-grade vial, store at -20°C, sealed and protected from light and moisture.",
      "reconstituted": "Store reconstituted material at 2-8°C. Do not freeze or shake. The usable period depends on the diluent and formulation and should not be stated without lot-specific instructions."
    }
  },
  "IGF-1 LR3": {
    "form": "Lyophilized recombinant protein",
    "appearance": "Lyophilized recombinant protein; color is lot-specific.",
    "casNumber": "143045-27-6",
    "sequence": "MFPAMPLISLFVNGPRTLCGAELVDALQFVCGDRGFYFNKPTGYGSSSRRAPQTGIVDECCFRSCDLRRLEMYCAPLKPAKSA.",
    "activeComponents": null,
    "proteinStructure": null,
    "packaging": "10 sealed vials per kit",
    "intendedUse": "Laboratory research use only",
    "storage": {
      "lyophilized": "Store at -20°C in a sealed, desiccated vial.",
      "reconstituted": "Keep at 2-8°C for short-term use. For extended storage, aliquot in an appropriate carrier/buffer and store at -20°C to -80°C. Avoid repeated freeze-thaw cycles."
    }
  },
  "Ipamorelin": {
    "form": "Lyophilized powder",
    "appearance": "White to off-white lyophilized powder.",
    "casNumber": "170851-70-4",
    "sequence": "Aib-His-D-2-Nal-D-Phe-Lys-NH2.",
    "activeComponents": null,
    "proteinStructure": null,
    "packaging": "10 sealed vials per kit",
    "intendedUse": "Laboratory research use only",
    "storage": {
      "lyophilized": "Store at -20°C in a tightly sealed vial, protected from light and moisture. Allow the sealed vial to reach room temperature before opening.",
      "reconstituted": "For short-term laboratory handling, keep at 2-8°C. For longer storage, aliquot and freeze at <=-20°C when the experimental buffer is compatible. Avoid repeated freeze-thaw cycles."
    }
  },
  "KLOW": {
    "form": "Lyophilized powder",
    "appearance": "Blue to blue-green lyophilized material; shade may vary with formulation.",
    "casNumber": null,
    "sequence": null,
    "activeComponents": "KPV 10 mg + BPC-157 10 mg + GHK-Cu 50 mg + thymosin beta-4 (TB-500) 10 mg per vial.",
    "proteinStructure": null,
    "packaging": "10 sealed vials per kit",
    "intendedUse": "Laboratory research use only",
    "storage": {
      "lyophilized": "Store at -20°C in a tightly sealed vial, protected from light and moisture. Allow the sealed vial to reach room temperature before opening.",
      "reconstituted": "For short-term laboratory handling, keep at 2-8°C. For longer storage, aliquot and freeze at <=-20°C when the experimental buffer is compatible. Avoid repeated freeze-thaw cycles."
    }
  },
  "KPV": {
    "form": "Lyophilized powder",
    "appearance": "White to off-white lyophilized powder.",
    "casNumber": "67727-97-3",
    "sequence": "Lys-Pro-Val-OH.",
    "activeComponents": null,
    "proteinStructure": null,
    "packaging": "10 sealed vials per kit",
    "intendedUse": "Laboratory research use only",
    "storage": {
      "lyophilized": "Store at -20°C in a tightly sealed vial, protected from light and moisture. Allow the sealed vial to reach room temperature before opening.",
      "reconstituted": "For short-term laboratory handling, keep at 2-8°C. For longer storage, aliquot and freeze at <=-20°C when the experimental buffer is compatible. Avoid repeated freeze-thaw cycles."
    }
  },
  "Kisspeptin-10": {
    "form": "Lyophilized powder",
    "appearance": "White to off-white lyophilized powder.",
    "casNumber": "374675-21-5",
    "sequence": "Tyr-Asn-Trp-Asn-Ser-Phe-Gly-Leu-Arg-Phe-NH2.",
    "activeComponents": null,
    "proteinStructure": null,
    "packaging": "10 sealed vials per kit",
    "intendedUse": "Laboratory research use only",
    "storage": {
      "lyophilized": "Store at -20°C in a tightly sealed vial, protected from light and moisture. Allow the sealed vial to reach room temperature before opening.",
      "reconstituted": "For short-term laboratory handling, keep at 2-8°C. For longer storage, aliquot and freeze at <=-20°C when the experimental buffer is compatible. Avoid repeated freeze-thaw cycles."
    }
  },
  "MOTS-c": {
    "form": "Lyophilized powder",
    "appearance": "White to off-white lyophilized powder.",
    "casNumber": "1627580-64-6",
    "sequence": "Met-Arg-Trp-Gln-Glu-Met-Gly-Tyr-Ile-Phe-Tyr-Pro-Arg-Lys-Leu-Arg.",
    "activeComponents": null,
    "proteinStructure": null,
    "packaging": "10 sealed vials per kit",
    "intendedUse": "Laboratory research use only",
    "storage": {
      "lyophilized": "Store at -20°C in a tightly sealed vial, protected from light and moisture. Allow the sealed vial to reach room temperature before opening.",
      "reconstituted": "For short-term laboratory handling, keep at 2-8°C. For longer storage, aliquot and freeze at <=-20°C when the experimental buffer is compatible. Avoid repeated freeze-thaw cycles."
    }
  },
  "Melanotan I": {
    "form": "Lyophilized powder",
    "appearance": "White to off-white lyophilized powder.",
    "casNumber": "75921-69-6",
    "sequence": "Ac-Ser-Tyr-Ser-Nle-Glu-His-D-Phe-Arg-Trp-Gly-Lys-Pro-Val-NH2.",
    "activeComponents": null,
    "proteinStructure": null,
    "packaging": "10 sealed vials per kit",
    "intendedUse": "Laboratory research use only",
    "storage": {
      "lyophilized": "Store at -20°C in a tightly sealed vial, protected from light and moisture. Allow the sealed vial to reach room temperature before opening.",
      "reconstituted": "For short-term laboratory handling, keep at 2-8°C. For longer storage, aliquot and freeze at <=-20°C when the experimental buffer is compatible. Avoid repeated freeze-thaw cycles."
    }
  },
  "Melanotan II": {
    "form": "Lyophilized powder",
    "appearance": "White to off-white lyophilized powder.",
    "casNumber": "121062-08-6",
    "sequence": "Ac-Nle-cyclo[Asp-His-D-Phe-Arg-Trp-Lys]-NH2.",
    "activeComponents": null,
    "proteinStructure": null,
    "packaging": "10 sealed vials per kit",
    "intendedUse": "Laboratory research use only",
    "storage": {
      "lyophilized": "Store at -20°C in a tightly sealed vial, protected from light and moisture. Allow the sealed vial to reach room temperature before opening.",
      "reconstituted": "For short-term laboratory handling, keep at 2-8°C. For longer storage, aliquot and freeze at <=-20°C when the experimental buffer is compatible. Avoid repeated freeze-thaw cycles."
    }
  },
  "NAD+": {
    "form": "Lyophilized material / powder",
    "appearance": "White to off-white lyophilized material.",
    "casNumber": "53-84-9",
    "sequence": null,
    "activeComponents": null,
    "proteinStructure": null,
    "packaging": "10 sealed vials per kit",
    "intendedUse": "Laboratory research use only",
    "storage": {
      "lyophilized": "Store at -20°C, tightly sealed and desiccated.",
      "reconstituted": "Prepare solutions fresh whenever possible. Keep neutral or mildly acidic solutions cold for short-term handling; for extended storage, use single-use aliquots at -70°C to -80°C. Avoid alkaline conditions and repeated thawing."
    }
  },
  "Oxytocin Acetate": {
    "form": "Lyophilized powder",
    "appearance": "White to off-white lyophilized powder.",
    "casNumber": "50-56-6",
    "sequence": "Cys-Tyr-Ile-Gln-Asn-Cys-Pro-Leu-Gly-NH2; intramolecular disulfide bridge between Cys1 and Cys6.",
    "activeComponents": null,
    "proteinStructure": null,
    "packaging": "10 sealed vials per kit",
    "intendedUse": "Laboratory research use only",
    "storage": {
      "lyophilized": "Store at -20°C in a tightly sealed vial, protected from light and moisture. Allow the sealed vial to reach room temperature before opening.",
      "reconstituted": "For short-term laboratory handling, keep at 2-8°C. For longer storage, aliquot and freeze at <=-20°C when the experimental buffer is compatible. Avoid repeated freeze-thaw cycles."
    }
  },
  "PE-22-28": {
    "form": "Lyophilized powder",
    "appearance": "Lyophilized peptide powder; color is lot-specific.",
    "casNumber": null,
    "sequence": "Gly-Val-Ser-Trp-Gly-Leu-Arg-OH.",
    "activeComponents": null,
    "proteinStructure": null,
    "packaging": "10 sealed vials per kit",
    "intendedUse": "Laboratory research use only",
    "storage": {
      "lyophilized": "Store at -20°C in a tightly sealed vial, protected from light and moisture. Allow the sealed vial to reach room temperature before opening.",
      "reconstituted": "For short-term laboratory handling, keep at 2-8°C. For longer storage, aliquot and freeze at <=-20°C when the experimental buffer is compatible. Avoid repeated freeze-thaw cycles."
    }
  },
  "PT-141": {
    "form": "Lyophilized powder",
    "appearance": "White to off-white lyophilized powder.",
    "casNumber": "189691-06-3",
    "sequence": "Ac-Nle-cyclo[Asp-His-D-Phe-Arg-Trp-Lys]-OH.",
    "activeComponents": null,
    "proteinStructure": null,
    "packaging": "10 sealed vials per kit",
    "intendedUse": "Laboratory research use only",
    "storage": {
      "lyophilized": "Store at -20°C in a tightly sealed vial, protected from light and moisture. Allow the sealed vial to reach room temperature before opening.",
      "reconstituted": "For short-term laboratory handling, keep at 2-8°C. For longer storage, aliquot and freeze at <=-20°C when the experimental buffer is compatible. Avoid repeated freeze-thaw cycles."
    }
  },
  "Pinealon": {
    "form": "Lyophilized powder",
    "appearance": "White to off-white lyophilized powder.",
    "casNumber": "175175-23-2",
    "sequence": "Glu-Asp-Arg-OH.",
    "activeComponents": null,
    "proteinStructure": null,
    "packaging": "10 sealed vials per kit",
    "intendedUse": "Laboratory research use only",
    "storage": {
      "lyophilized": "Store at -20°C in a tightly sealed vial, protected from light and moisture. Allow the sealed vial to reach room temperature before opening.",
      "reconstituted": "For short-term laboratory handling, keep at 2-8°C. For longer storage, aliquot and freeze at <=-20°C when the experimental buffer is compatible. Avoid repeated freeze-thaw cycles."
    }
  },
  "Retatrutide": {
    "form": "Lyophilized powder",
    "appearance": "White to off-white lyophilized powder.",
    "casNumber": "2381089-83-2",
    "sequence": "Tyr-Aib-Gln-Gly-Thr-Phe-Thr-Ser-Asp-Tyr-Ser-Ile-alphaMeLeu-Leu-Asp-Lys-Lys[PEG2-gamma-Glu-eicosanedioic acid]-Ala-Gln-Aib-Ala-Phe-Ile-Glu-Tyr-Leu-Leu-Glu-Gly-Gly-Pro-Ser-Ser-Gly-Ala-Pro-Pro-Pro-Ser-NH2.",
    "activeComponents": null,
    "proteinStructure": null,
    "packaging": "10 sealed vials per kit",
    "intendedUse": "Laboratory research use only",
    "storage": {
      "lyophilized": "Store at -20°C in a tightly sealed vial, protected from light and moisture. Allow the sealed vial to reach room temperature before opening.",
      "reconstituted": "For short-term laboratory handling, keep at 2-8°C. For longer storage, aliquot and freeze at <=-20°C when the experimental buffer is compatible. Avoid repeated freeze-thaw cycles."
    }
  },
  "SS-31": {
    "form": "Lyophilized powder",
    "appearance": "White to off-white lyophilized powder.",
    "casNumber": "736992-21-5",
    "sequence": "D-Arg-Dmt-Lys-Phe-NH2 (Dmt = 2,6-dimethyltyrosine).",
    "activeComponents": null,
    "proteinStructure": null,
    "packaging": "10 sealed vials per kit",
    "intendedUse": "Laboratory research use only",
    "storage": {
      "lyophilized": "Store at -20°C in a tightly sealed vial, protected from light and moisture. Allow the sealed vial to reach room temperature before opening.",
      "reconstituted": "For short-term laboratory handling, keep at 2-8°C. For longer storage, aliquot and freeze at <=-20°C when the experimental buffer is compatible. Avoid repeated freeze-thaw cycles."
    }
  },
  "Selank": {
    "form": "Lyophilized powder",
    "appearance": "White to off-white lyophilized powder.",
    "casNumber": "129954-34-3",
    "sequence": "Thr-Lys-Pro-Arg-Pro-Gly-Pro-OH.",
    "activeComponents": null,
    "proteinStructure": null,
    "packaging": "10 sealed vials per kit",
    "intendedUse": "Laboratory research use only",
    "storage": {
      "lyophilized": "Store at -20°C in a tightly sealed vial, protected from light and moisture. Allow the sealed vial to reach room temperature before opening.",
      "reconstituted": "For short-term laboratory handling, keep at 2-8°C. For longer storage, aliquot and freeze at <=-20°C when the experimental buffer is compatible. Avoid repeated freeze-thaw cycles."
    }
  },
  "Semax": {
    "form": "Lyophilized powder",
    "appearance": "White to off-white lyophilized powder.",
    "casNumber": "80714-61-0",
    "sequence": "Met-Glu-His-Phe-Pro-Gly-Pro-OH.",
    "activeComponents": null,
    "proteinStructure": null,
    "packaging": "10 sealed vials per kit",
    "intendedUse": "Laboratory research use only",
    "storage": {
      "lyophilized": "Store at -20°C in a tightly sealed vial, protected from light and moisture. Allow the sealed vial to reach room temperature before opening.",
      "reconstituted": "For short-term laboratory handling, keep at 2-8°C. For longer storage, aliquot and freeze at <=-20°C when the experimental buffer is compatible. Avoid repeated freeze-thaw cycles."
    }
  },
  "Sermorelin": {
    "form": "Lyophilized powder",
    "appearance": "White to off-white lyophilized powder.",
    "casNumber": "86168-78-7",
    "sequence": "Tyr-Ala-Asp-Ala-Ile-Phe-Thr-Asn-Ser-Tyr-Arg-Lys-Val-Leu-Gly-Gln-Leu-Ser-Ala-Arg-Lys-Leu-Leu-Gln-Asp-Ile-Met-Ser-Arg-NH2.",
    "activeComponents": null,
    "proteinStructure": null,
    "packaging": "10 sealed vials per kit",
    "intendedUse": "Laboratory research use only",
    "storage": {
      "lyophilized": "Store at -20°C in a tightly sealed vial, protected from light and moisture. Allow the sealed vial to reach room temperature before opening.",
      "reconstituted": "For short-term laboratory handling, keep at 2-8°C. For longer storage, aliquot and freeze at <=-20°C when the experimental buffer is compatible. Avoid repeated freeze-thaw cycles."
    }
  },
  "TB-500": {
    "form": "Lyophilized powder",
    "appearance": "White to off-white lyophilized powder.",
    "casNumber": "77591-33-4",
    "sequence": "Ac-SDKPDMAEIEKFDKSKLKKTETQEKNPLPSKETIEQEKQAGES.",
    "activeComponents": null,
    "proteinStructure": null,
    "packaging": "10 sealed vials per kit",
    "intendedUse": "Laboratory research use only",
    "storage": {
      "lyophilized": "Store at -20°C in a tightly sealed vial, protected from light and moisture. Allow the sealed vial to reach room temperature before opening.",
      "reconstituted": "For short-term laboratory handling, keep at 2-8°C. For longer storage, aliquot and freeze at <=-20°C when the experimental buffer is compatible. Avoid repeated freeze-thaw cycles."
    }
  },
  "Tesamorelin": {
    "form": "Lyophilized powder",
    "appearance": "White to off-white lyophilized powder.",
    "casNumber": "218949-48-5",
    "sequence": "(trans-3-hexenoyl)-Tyr-Ala-Asp-Ala-Ile-Phe-Thr-Asn-Ser-Tyr-Arg-Lys-Val-Leu-Gly-Gln-Leu-Ser-Ala-Arg-Lys-Leu-Leu-Gln-Asp-Ile-Met-Ser-Arg-Gln-Gln-Gly-Glu-Ser-Asn-Gln-Glu-Arg-Gly-Ala-Arg-Ala-Arg-Leu-NH2.",
    "activeComponents": null,
    "proteinStructure": null,
    "packaging": "10 sealed vials per kit",
    "intendedUse": "Laboratory research use only",
    "storage": {
      "lyophilized": "Store at -20°C in a tightly sealed vial, protected from light and moisture. Allow the sealed vial to reach room temperature before opening.",
      "reconstituted": "For the research-grade vial, keep at 2-8°C for short-term laboratory handling and avoid repeated freeze-thaw cycles. Do not state a fixed holding time without formulation-specific data."
    }
  },
  "Thymalin": {
    "form": "Lyophilized powder",
    "appearance": "White to off-white lyophilized powder.",
    "casNumber": null,
    "sequence": null,
    "activeComponents": null,
    "proteinStructure": null,
    "packaging": "10 sealed vials per kit",
    "intendedUse": "Laboratory research use only",
    "storage": {
      "lyophilized": "Store at -20°C in a tightly sealed vial, protected from light and moisture. Allow the sealed vial to reach room temperature before opening.",
      "reconstituted": "For short-term laboratory handling, keep at 2-8°C. For longer storage, aliquot and freeze at <=-20°C when the experimental buffer is compatible. Avoid repeated freeze-thaw cycles."
    }
  },
  "Thymosin Alpha-1": {
    "form": "Lyophilized powder",
    "appearance": "White to off-white lyophilized powder.",
    "casNumber": "62304-98-7",
    "sequence": "Ac-SDAAVDTSSEITTKDLKEKKEVVEEAEN.",
    "activeComponents": null,
    "proteinStructure": null,
    "packaging": "10 sealed vials per kit",
    "intendedUse": "Laboratory research use only",
    "storage": {
      "lyophilized": "Store at -20°C in a tightly sealed vial, protected from light and moisture. Allow the sealed vial to reach room temperature before opening.",
      "reconstituted": "For short-term laboratory handling, keep at 2-8°C. For longer storage, aliquot and freeze at <=-20°C when the experimental buffer is compatible. Avoid repeated freeze-thaw cycles."
    }
  },
  "Tirzepatide": {
    "form": "Lyophilized powder",
    "appearance": "White to off-white lyophilized powder.",
    "casNumber": "2023788-19-2",
    "sequence": "Tyr-Aib-Glu-Gly-Thr-Phe-Thr-Ser-Asp-Tyr-Ser-Ile-Aib-Leu-Asp-Lys-Ile-Ala-Gln-Lys(AEEA-AEEA-gamma-Glu-eicosanedioic acid)-Ala-Phe-Val-Gln-Trp-Leu-Ile-Ala-Gly-Gly-Pro-Ser-Ser-Gly-Ala-Pro-Pro-Pro-Ser-NH2.",
    "activeComponents": null,
    "proteinStructure": null,
    "packaging": "10 sealed vials per kit",
    "intendedUse": "Laboratory research use only",
    "storage": {
      "lyophilized": "Store at -20°C in a tightly sealed vial, protected from light and moisture. Allow the sealed vial to reach room temperature before opening.",
      "reconstituted": "For short-term laboratory handling, keep at 2-8°C. For longer storage, aliquot and freeze at <=-20°C when the experimental buffer is compatible. Avoid repeated freeze-thaw cycles."
    }
  }
};
