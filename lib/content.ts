import { assetPath } from "@/lib/site-config";

export const christineWhatsapp = "https://wa.me/12137038679";
export const lunaWhatsapp = "https://wa.me/85298417612";
export const whatsappUrl = christineWhatsapp;
export const whatsappChannel = "https://whatsapp.com/channel/0029Vb8k5HeJP20vWiJ2Sk1E";
export const email = "christinepeptide@gmail.com";

export type Product = {
  name: string;
  slug: string;
  category: string;
  codes: string[];
  specs: string[];
  featured?: boolean;
};

const product = (
  name: string,
  slug: string,
  codes: string[],
  specs: string[],
  category = "Research Peptides",
  featured = false,
): Product => ({ name, slug, category, codes, specs, featured });

export const products: Product[] = [
  product("Retatrutide", "retatrutide", ["RT5","RT10","RT15","RT20","RT30","RT60"], ["5mg","10mg","15mg","20mg","30mg","60mg"], "Metabolic Research", true),
  product("Tirzepatide", "tirzepatide", ["TR10","TR15","TR20","TR30","TR40","TR60"], ["10mg","15mg","20mg","30mg","40mg","60mg"], "Metabolic Research", true),
  product("Acetic Acid", "acetic-acid", ["AA5","AA10"], ["5mg","10mg"], "Research Supplies"),
  product("Adamax", "adamax", ["ADA5","ADA10"], ["5mg","10mg"]),
  product("AICAR", "aicar", ["AR100"], ["100mg"]),
  product("ARA-290 (Cibinetide)", "ara-290", ["RA10"], ["10mg"]),
  product("AOD9604", "aod9604", ["5AD","10AD"], ["5mg","10mg"]),
  product("AHK-CU", "ahk-cu", ["AU50"], ["50mg"], "Cosmetic Research"),
  product("5-Amino-1MQ", "5-amino-1mq", ["50AM","10AM"], ["50mg","10mg"]),
  product("BPC-157", "bpc-157", ["BC5","BC10"], ["5mg","10mg"], "Recovery Research", true),
  product("BPC-157 + TB-500", "bpc-157-tb-500", ["BB10","BB20","BB30"], ["5mg + 5mg","10mg + 10mg","15mg + 15mg"], "Recovery Research", true),
  product("Sterile Water", "sterile-water", ["WA3","WA10"], ["3ml","10ml"], "Research Supplies"),
  product("Cagrilintide", "cagrilintide", ["CGL5","CGL10"], ["5mg","10mg"], "Metabolic Research"),
  product("CJC-1295 With DAC", "cjc-1295-with-dac", ["CD5","CD10"], ["5mg","10mg"]),
  product("CJC-1295 Without DAC", "cjc-1295-without-dac", ["CND5","CND10"], ["5mg","10mg"]),
  product("CJC-1295 Without DAC + Ipamorelin", "cjc-1295-ipamorelin", ["CP10","CP20"], ["5mg + 5mg","10mg + 10mg"]),
  product("Cartalax", "cartalax", ["CART20"], ["20mg"]),
  product("Cerebrolysin", "cerebrolysin", ["CBL60"], ["60mg"]),
  product("DSIP", "dsip", ["DS5","DS10"], ["5mg","10mg"]),
  product("Epithalon", "epithalon", ["ET10","ET50"], ["10mg","50mg"]),
  product("GHK-CU", "ghk-cu", ["CU50","CU100"], ["50mg","100mg"], "Cosmetic Research", true),
  product("Glutathione", "glutathione", ["GTT1500","GTT600"], ["1500mg","600mg"], "Cosmetic Research"),
  product("GLOW", "glow", ["BBG70"], ["BPC-157 10mg + GHK-CU 50mg + TB-500 10mg"], "Blends", true),
  product("HCG", "hcg", ["G2K","G5K","G10K"], ["2,000 IU","5,000 IU","10,000 IU"]),
  product("Ipamorelin", "ipamorelin", ["IP5","IP10"], ["5mg","10mg"]),
  product("IGF-1 LR3", "igf-1-lr3", ["IG1"], ["1mg"]),
  product("KLOW", "klow", ["KL80"], ["KPV 10mg + BPC-157 10mg + GHK-CU 50mg + TB-500 10mg"], "Blends", true),
  product("KPV", "kpv", ["KP5","KP10"], ["5mg","10mg"]),
  product("Kisspeptin", "kisspeptin", ["KS5","KS10"], ["5mg","10mg"]),
  product("Lemon Bottle", "lemon-bottle", ["LB10"], ["10mg"], "Cosmetic Research"),
  product("MOTS-C", "mots-c", ["MS10","MS20","MS40"], ["10mg","20mg","40mg"], "Metabolic Research", true),
  product("Melanotan I", "melanotan-i", ["MT1"], ["10mg"]),
  product("Melanotan II", "melanotan-ii", ["ML10"], ["10mg"]),
  product("NAD+", "nad-plus", ["NJ500","NJ1000"], ["500mg","1000mg"], "Metabolic Research", true),
  product("Oxytocin Acetate", "oxytocin-acetate", ["OT5","OT10"], ["5mg","10mg"]),
  product("PE-22-28", "pe-22-28", ["PE5","PE10"], ["5mg","10mg"]),
  product("PT-141", "pt-141", ["P41"], ["10mg"]),
  product("Pinealon", "pinealon", ["PI10"], ["10mg"]),
  product("Sermorelin", "sermorelin", ["SMO5","SMO10"], ["5mg","10mg"]),
  product("Selank", "selank", ["SK5","SK10"], ["5mg","10mg"]),
  product("Semax", "semax", ["XA5","XA10"], ["5mg","10mg"]),
  product("SS-31", "ss-31", ["2S10","2S50"], ["10mg","50mg"]),
  product("Thymosin Alpha-1", "thymosin-alpha-1", ["TA5","TA10"], ["5mg","10mg"]),
  product("TB-500 (Thymosin B4 Acetate)", "tb-500", ["BT5","BT10"], ["5mg","10mg"], "Recovery Research", true),
  product("Tesamorelin", "tesamorelin", ["TSM5","TSM10","TSM20"], ["5mg","10mg","20mg"]),
  product("Thymalin / Thymulin", "thymalin-thymulin", ["TY10"], ["10mg"]),
  product("BAC Water", "bac-water", ["BA3","BA10"], ["3ml","10ml"], "Research Supplies"),
];

export const featuredProducts = products.filter((item) => item.featured);

export type Certificate = {
  slug: string;
  name: string;
  testType: "Mass / Purity" | "Endotoxin";
  reportUrl: string;
  reportNumber: string;
  verificationKey: string;
  sampleCode: string;
  reportImage?: string;
};

const publishedReportNumbers = new Set([
  "148325", "153775", "153776", "153787", "153788", "153791", "153792",
  "157419", "157420", "157421", "198332", "198333", "198334", "198335",
  "198338", "198339", "200491", "200492",
]);

const certificate = (slug: string, name: string, testType: Certificate["testType"], reportUrl: string): Certificate => {
  const record = reportUrl.split("/").pop() ?? "";
  const [reportNumber = "", ...rest] = record.split("-");
  const reportKey = rest.join("-").split("_");
  return {
    slug,
    name,
    testType,
    reportUrl,
    reportNumber,
    sampleCode: reportKey[0] ?? "",
    verificationKey: reportKey[1] ?? "",
    reportImage: publishedReportNumbers.has(reportNumber) ? `/images/coa/report-${reportNumber}.png` : undefined,
  };
};

const coa = (code: string, name: string, mass: string, endotoxin: string): Certificate[] => [
  certificate(`${code.toLowerCase()}-mass-purity`, name, "Mass / Purity", mass),
  certificate(`${code.toLowerCase()}-endotoxin`, name, "Endotoxin", endotoxin),
];

export const certificates: Certificate[] = [
  ...coa("KLOW80","KLOW 80mg","https://janoshik.com/tests/200491-KLOW80_BBI8X5D2EKTF","https://janoshik.com/tests/200492-KLOW80_KB9ZV6RAM99W"),
  ...coa("GHKCU50","GHK-CU 50mg","https://janoshik.com/tests/198338-GHKCU50_7YWYHRHCLAXS","https://janoshik.com/tests/198339-GHKCU50_K6K7811N1YSS"),
  ...coa("RT40","Retatrutide 40mg","https://janoshik.com/tests/198332-RT40_YGMARYXXBXBM","https://janoshik.com/tests/198333-RT40_LDFD7QFWQ3IW"),
  ...coa("RT50","Retatrutide 50mg","https://janoshik.com/tests/198334-RT50_E8YFEAFDQP22","https://janoshik.com/tests/198335-RT50_IX65LB1KY1D5"),
  ...coa("MOTS40","MOTS-C 40mg","https://janoshik.com/tests/157419-MOTS40_VXJWRYZWM3X2","https://janoshik.com/tests/157420-MOTS40_3SCM7SMJKGRV"),
  ...coa("KPV10","KPV 10mg","https://janoshik.com/tests/153791-KPV_U16HY2YMVBQ1","https://janoshik.com/tests/153792-KPV_QVTWP4Z4NTJD"),
  ...coa("TR40","Tirzepatide 40mg","https://janoshik.com/tests/153775-TR40_676BFIDUUUP5","https://janoshik.com/tests/153776-TR40_3IG4PA29V77W"),
  ...coa("TESA10","Tesamorelin 10mg","https://janoshik.com/tests/153787-TESA10_FZ52MTSTUB5J","https://janoshik.com/tests/153788-TESA10_1HDFDF14VSD9"),
  ...coa("RT60","Retatrutide 60mg","https://janoshik.com/tests/157417-RT60_CEQN8FBULFA8","https://janoshik.com/tests/157418-RT60_JRSEEKRTW5YQ"),
  ...coa("RT10","Retatrutide 10mg","https://janoshik.com/tests/153777-RT10_SLSRXACR5NPX","https://janoshik.com/tests/153778-RT10_FADVC951A41G"),
  ...coa("RT20","Retatrutide 20mg","https://janoshik.com/tests/153779-RT20_ZKQI2GMY58BN","https://janoshik.com/tests/153780-RT20_9PYASMXM4W1Z"),
  ...coa("RT30","Retatrutide 30mg","https://janoshik.com/tests/153773-RT30_N8HHH7B6T3HF","https://janoshik.com/tests/153774-RT30_3W86I4F9SEMI"),
  ...coa("TB10","TB-500 10mg","https://janoshik.com/tests/153781-TB10_8NIF6UBJAWQI","https://janoshik.com/tests/153782-TB10_EWZDCYLY9RD7"),
  ...coa("NAD1000","NAD+ 1000mg","https://janoshik.com/tests/157421-NAD1000_46VA2MEPI29X","https://janoshik.com/tests/148325-NAD1000_4DJ4PAB9NEXP"),
  ...coa("TR30T","Tirzepatide 30mg","https://janoshik.com/tests/153769-TR30_YG384LUX2484","https://janoshik.com/tests/153770-TR30_DQW81C1NHESG"),
  ...coa("TR10T","Tirzepatide 10mg","https://janoshik.com/tests/153771-TR10_C7KQKE2DWNEL","https://janoshik.com/tests/153772-TR10_V64SECCS79JL"),
  ...coa("IPA10","Ipamorelin 10mg","https://janoshik.com/tests/153789-IPA10_DFCD14XCWEW4","https://janoshik.com/tests/153790-IPA10_NDVT4YUR4L44"),
];

export const publishedCertificates = certificates.filter((item) => item.reportImage);

export const testimonials = [
  { name: "aebowman", quote: "Ordered July 15, delivered July 21! Thanks for the great service.", note: "Customer review", image: "/images/reviews/order-01.jpeg" },
  { name: "DG", quote: "Ordered on July 16 and delivered on July 22. Huge thank you to Christine!", note: "Customer review", image: "/images/reviews/order-02.jpg" },
  { name: "Shellica", quote: "Ordered July 7 from China and arrived July 27 in Alberta, Canada. Thanks, Christine!", note: "Alberta, Canada", image: "/images/reviews/order-03.png" },
  { name: "DeeT🐢", quote: "Thank you for your patience. I was wishy-washy about this order, but here it is!", note: "Customer review", image: "/images/reviews/order-04.jpg" },
  { name: "ZVRII", quote: "Order was placed July 19, I received my tracking number July 20, and delivery from China was completed July 27.", note: "Customer review", image: "/images/reviews/order-05.jpg" },
  { name: "yeahnooo", quote: "Thank you, JP! I received Reta and KLOW after ordering on July 19, with delivery on July 27. Everything arrived great!", note: "Customer review", image: "/images/reviews/order-06.jpg" },
];

export const articles = [
  {
    slug: "how-to-verify-a-peptide-coa",
    title: "How to Verify a Peptide COA",
    date: "30 July 2026",
    image: assetPath("/images/jike/hero-lab.jpg"),
    summary: "A practical checklist for reviewing batch-linked third-party analytical reports.",
    sections: [
      { heading: "Use the original verification link", paragraphs: ["A screenshot alone is not enough. Match the report number and unique key on the laboratory’s original verification page."] },
      { heading: "Match the product and batch", paragraphs: ["Confirm the product name, specification, sample identifier and test date. Request the current batch report before ordering."] },
    ],
  },
];
