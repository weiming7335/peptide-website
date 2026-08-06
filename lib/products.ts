export type ProductSpec = {
  code: string;
  presentation: string;
};

export type Product = {
  name: string;
  slug: string;
  image: string;
  dataSheet: string;
  specs: ProductSpec[];
  featured?: boolean;
};

const spec = (code: string, presentation: string): ProductSpec => ({ code, presentation });

const product = (
  name: string,
  slug: string,
  image: string,
  dataSheet: string,
  specs: ProductSpec[],
  featured = false,
): Product => ({ name, slug, image: `/products/${image}`, dataSheet: `/data-sheets/${dataSheet}`, specs, featured });

export const products: Product[] = [
  product("5-Amino-1MQ", "5-amino-1mq", "5-amino-1mq.png", "5-Amino-1MQ.pdf", [spec("50AM", "50 mg x 10 vials"), spec("10AM", "10 mg x 10 vials")]),
  product("Adamax", "adamax", "Adamax.png", "Adamax.pdf", [spec("ADA5", "5 mg x 10 vials"), spec("ADA10", "10 mg x 10 vials")]),
  product("AHK-Cu", "ahk-cu", "AHK-CU.png", "AHK-Cu.pdf", [spec("AU50", "50 mg x 10 vials")]),
  product("AICAR", "aicar", "Aicar.png", "AICAR.pdf", [spec("AR100", "100 mg x 10 vials")]),
  product("AOD-9604", "aod-9604", "Aod9604.png", "AOD-9604.pdf", [spec("5AD", "5 mg x 10 vials"), spec("10AD", "10 mg x 10 vials")]),
  product("ARA-290", "ara-290", "Ara-290.png", "ARA-290.pdf", [spec("RA10", "10 mg x 10 vials")]),
  product("BPC-157 + TB-500", "bpc-157-tb-500", "BPC-157+TB-500.png", "BPC-157 + TB-500.pdf", [spec("BB10", "5 mg + 5 mg/vial x 10 vials"), spec("BB20", "10 mg + 10 mg/vial x 10 vials"), spec("BB30", "15 mg + 15 mg/vial x 10 vials")], true),
  product("BPC-157", "bpc-157", "BPC-157png.png", "BPC-157.pdf", [spec("BC5", "5 mg x 10 vials"), spec("BC10", "10 mg x 10 vials")], true),
  product("Cagrilintide", "cagrilintide", "Cagrilintide.png", "Cagrilintide.pdf", [spec("CGL5", "5 mg x 10 vials"), spec("CGL10", "10 mg x 10 vials")]),
  product("Cartalax", "cartalax", "Cartalax.png", "Cartalax.pdf", [spec("CART20", "20 mg x 10 vials")]),
  product("CJC-1295 (with DAC)", "cjc-1295-with-dac", "CJC-1295 with DAC.png", "CJC-1295 (with DAC).pdf", [spec("CD5", "5 mg x 10 vials"), spec("CD10", "10 mg x 10 vials")]),
  product("CJC-1295 (without DAC) + Ipamorelin", "cjc-1295-ipamorelin", "CJC-1295 without DAC + Ipamorelin.png", "CJC-1295 (without DAC) + Ipamorelin.pdf", [spec("CP10", "5 mg + 5 mg/vial x 10 vials"), spec("CP20", "10 mg + 10 mg/vial x 10 vials")]),
  product("CJC-1295 (without DAC)", "cjc-1295-without-dac", "CJC-1295 without DAC.png", "CJC-1295 (without DAC).pdf", [spec("CND5", "5 mg x 10 vials"), spec("CND10", "10 mg x 10 vials")]),
  product("DSIP", "dsip", "DSIP.png", "DSIP.pdf", [spec("DS5", "5 mg x 10 vials"), spec("DS10", "10 mg x 10 vials")]),
  product("Epitalon", "epitalon", "Epithalon.png", "Epitalon.pdf", [spec("ET10", "10 mg x 10 vials"), spec("ET50", "50 mg x 10 vials")]),
  product("GHK-Cu", "ghk-cu", "GHK-CU.png", "GHK-Cu.pdf", [spec("CU50", "50 mg x 10 vials"), spec("CU100", "100 mg x 10 vials")], true),
  product("GLOW", "glow", "Glow.png", "GLOW.pdf", [spec("BBG70", "70 mg x 10 vials")]),
  product("Glutathione", "glutathione", "Glutathione.png", "Glutathione.pdf", [spec("GTT1500", "1500 mg x 10 vials"), spec("GTT600", "600 mg x 10 vials")]),
  product("HCG", "hcg", "HCG.png", "HCG.pdf", [spec("G2K", "2000 IU x 10 vials"), spec("G5K", "5000 IU x 10 vials"), spec("G10K", "10000 IU x 10 vials")]),
  product("IGF-1 LR3", "igf-1-lr3", "IGF-1 LR3.png", "IGF-1 LR3.pdf", [spec("IG1", "1 mg x 10 vials")]),
  product("Ipamorelin", "ipamorelin", "Ipamorelin.png", "Ipamorelin.pdf", [spec("IP5", "5 mg x 10 vials"), spec("IP10", "10 mg x 10 vials")]),
  product("Kisspeptin-10", "kisspeptin-10", "Kisspeptin.png", "Kisspeptin-10.pdf", [spec("KS5", "5 mg x 10 vials"), spec("KS10", "10 mg x 10 vials")]),
  product("KLOW", "klow", "Klow.png", "KLOW.pdf", [spec("KL80", "80 mg x 10 vials")], true),
  product("KPV", "kpv", "KPV.png", "KPV.pdf", [spec("KP5", "5 mg x 10 vials"), spec("KP10", "10 mg x 10 vials")]),
  product("Melanotan I", "melanotan-i", "Melanotan I.png", "Melanotan I.pdf", [spec("MT1", "10 mg x 10 vials")]),
  product("Melanotan II", "melanotan-ii", "Melanotan II.png", "Melanotan II.pdf", [spec("ML10", "10 mg x 10 vials")]),
  product("MOTS-c", "mots-c", "Most-c.png", "MOTS-c.pdf", [spec("MS10", "10 mg x 10 vials"), spec("MS20", "20 mg x 10 vials"), spec("MS40", "40 mg x 10 vials")]),
  product("NAD+", "nad-plus", "NAD+.png", "NAD+.pdf", [spec("NJ500", "500 mg x 10 vials"), spec("NJ1000", "1000 mg x 10 vials")]),
  product("Oxytocin Acetate", "oxytocin-acetate", "Oxytocin Acetate.png", "Oxytocin Acetate.pdf", [spec("OT5", "5 mg x 10 vials"), spec("OT10", "10 mg x 10 vials")]),
  product("PE-22-28", "pe-22-28", "PE-22-28.png", "PE-22-28.pdf", [spec("PE5", "5 mg x 10 vials"), spec("PE10", "10 mg x 10 vials")]),
  product("Pinealon", "pinealon", "Pinealon.png", "Pinealon.pdf", [spec("PI10", "10 mg x 10 vials")]),
  product("PT-141", "pt-141", "PT-141.png", "PT-141.pdf", [spec("P41", "10 mg x 10 vials")]),
  product("Retatrutide", "retatrutide", "Retatrutide.png", "Retatrutide.pdf", [spec("RT5", "5 mg x 10 vials"), spec("RT10", "10 mg x 10 vials"), spec("RT15", "15 mg x 10 vials"), spec("RT20", "20 mg x 10 vials"), spec("RT30", "30 mg x 10 vials"), spec("RT60", "60 mg x 10 vials")], true),
  product("Selank", "selank", "Selank.png", "Selank.pdf", [spec("SK5", "5 mg x 10 vials"), spec("SK10", "10 mg x 10 vials")]),
  product("Semax", "semax", "Semax.png", "Semax.pdf", [spec("XA5", "5 mg x 10 vials"), spec("XA10", "10 mg x 10 vials")]),
  product("Sermorelin", "sermorelin", "Sermorelin.png", "Sermorelin.pdf", [spec("SMO5", "5 mg x 10 vials"), spec("SMO10", "10 mg x 10 vials")]),
  product("SS-31", "ss-31", "SS-31.png", "SS-31.pdf", [spec("2S10", "10 mg x 10 vials"), spec("2S50", "50 mg x 10 vials")]),
  product("TB-500", "tb-500", "TB-500.png", "TB-500.pdf", [spec("BT5", "5 mg x 10 vials"), spec("BT10", "10 mg x 10 vials")]),
  product("Tesamorelin", "tesamorelin", "Tesamorelin.png", "Tesamorelin.pdf", [spec("TSM5", "5 mg x 10 vials"), spec("TSM10", "10 mg x 10 vials"), spec("TSM20", "20 mg x 10 vials")], true),
  product("Thymalin", "thymalin", "Thymalin.png", "Thymalin.pdf", [spec("TY10", "10 mg x 10 vials")]),
  product("Thymosin Alpha-1", "thymosin-alpha-1", "Thymosin_Alpha-1.png", "Thymosin Alpha-1.pdf", [spec("TA5", "5 mg x 10 vials"), spec("TA10", "10 mg x 10 vials")]),
  product("Tirzepatide", "tirzepatide", "Tirzepatide.png", "Tirzepatide.pdf", [spec("TR10", "10 mg x 10 vials"), spec("TR15", "15 mg x 10 vials"), spec("TR20", "20 mg x 10 vials"), spec("TR30", "30 mg x 10 vials"), spec("TR40", "40 mg x 10 vials"), spec("TR60", "60 mg x 10 vials")], true),
];

export const featuredProducts = products.filter((item) => item.featured);

export function getProduct(slug: string) {
  return products.find((item) => item.slug === slug);
}
