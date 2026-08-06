export type TestReport = {
  product: string;
  sample: string;
  reportNumber: string;
  type: "Content / Purity" | "Endotoxin";
  verificationUrl: string;
  image: string;
};

const report = (product: string, sample: string, reportNumber: string, type: TestReport["type"], verificationUrl: string): TestReport => ({
  product,
  sample,
  reportNumber,
  type,
  verificationUrl,
  image: `/testing/report-${reportNumber}.png`,
});

export const reports: TestReport[] = [
  report("GHK-Cu", "GHKCU50", "198338", "Content / Purity", "https://janoshik.com/tests/198338-GHKCU50_7YWYHRHCLAXS"),
  report("GHK-Cu", "GHKCU50", "198339", "Endotoxin", "https://janoshik.com/tests/198339-GHKCU50_K6K7811N1YSS"),
  report("Ipamorelin", "IPA10", "153789", "Content / Purity", "https://janoshik.com/tests/153789-IPA10_DFCD14XCWEW4"),
  report("Ipamorelin", "IPA10", "153790", "Endotoxin", "https://janoshik.com/tests/153790-IPA10_NDVT4YUR4L44"),
  report("KLOW", "KLOW80", "200491", "Content / Purity", "https://janoshik.com/tests/200491-KLOW80_BBI8X5D2EKTF"),
  report("KLOW", "KLOW80", "200492", "Endotoxin", "https://janoshik.com/tests/200492-KLOW80_KB9ZV6RAM99W"),
  report("KPV", "KPV10", "153791", "Content / Purity", "https://janoshik.com/tests/153791-KPV_U16HY2YMVBQ1"),
  report("KPV", "KPV10", "153792", "Endotoxin", "https://janoshik.com/tests/153792-KPV_QVTWP4Z4NTJD"),
  report("MOTS-c", "MOTS40", "157419", "Content / Purity", "https://janoshik.com/tests/157419-MOTS40_VXJWRYZWM3X2"),
  report("MOTS-c", "MOTS40", "157420", "Endotoxin", "https://janoshik.com/tests/157420-MOTS40_3SCM7SMJKGRV"),
  report("NAD+", "NAD1000", "157421", "Content / Purity", "https://janoshik.com/tests/157421-NAD1000_46VA2MEPI29X"),
  report("NAD+", "NAD1000", "148325", "Endotoxin", "https://janoshik.com/tests/148325-NAD1000_4DJ4PAB9NEXP"),
  report("Retatrutide", "RT10", "153777", "Content / Purity", "https://janoshik.com/tests/153777-RT10_SLSRXACR5NPX"),
  report("Retatrutide", "RT10", "153778", "Endotoxin", "https://janoshik.com/tests/153778-RT10_FADVC951A41G"),
  report("Retatrutide", "RT20", "153779", "Content / Purity", "https://janoshik.com/tests/153779-RT20_ZKQI2GMY58BN"),
  report("Retatrutide", "RT20", "153780", "Endotoxin", "https://janoshik.com/tests/153780-RT20_9PYASMXM4W1Z"),
  report("Retatrutide", "RT30", "153773", "Content / Purity", "https://janoshik.com/tests/153773-RT30_N8HHH7B6T3HF"),
  report("Retatrutide", "RT30", "153774", "Endotoxin", "https://janoshik.com/tests/153774-RT30_3W86I4F9SEMI"),
  report("Retatrutide", "RT40", "198332", "Content / Purity", "https://janoshik.com/tests/198332-RT40_YGMARYXXBXBM"),
  report("Retatrutide", "RT40", "198333", "Endotoxin", "https://janoshik.com/tests/198333-RT40_LDFD7QFWQ3IW"),
  report("Retatrutide", "RT50", "198334", "Content / Purity", "https://janoshik.com/tests/198334-RT50_E8YFEAFDQP22"),
  report("Retatrutide", "RT50", "198335", "Endotoxin", "https://janoshik.com/tests/198335-RT50_IX65LB1KY1D5"),
  report("Retatrutide", "RT60", "157417", "Content / Purity", "https://janoshik.com/tests/157417-RT60_CEQN8FBULFA8"),
  report("Retatrutide", "RT60", "157418", "Endotoxin", "https://janoshik.com/tests/157418-RT60_JRSEEKRTW5YQ"),
  report("TB-500", "TB10", "153781", "Content / Purity", "https://janoshik.com/tests/153781-TB10_8NIF6UBJAWQI"),
  report("TB-500", "TB10", "153782", "Endotoxin", "https://janoshik.com/tests/153782-TB10_EWZDCYLY9RD7"),
  report("Tesamorelin", "TESA10", "153787", "Content / Purity", "https://janoshik.com/tests/153787-TESA10_FZ52MTSTUB5J"),
  report("Tesamorelin", "TESA10", "153788", "Endotoxin", "https://janoshik.com/tests/153788-TESA10_1HDFDF14VSD9"),
  report("Tirzepatide", "TR10", "153771", "Content / Purity", "https://janoshik.com/tests/153771-TR10_C7KQKE2DWNEL"),
  report("Tirzepatide", "TR10", "153772", "Endotoxin", "https://janoshik.com/tests/153772-TR10_V64SECCS79JL"),
  report("Tirzepatide", "TR30", "153769", "Content / Purity", "https://janoshik.com/tests/153769-TR30_YG384LUX2484"),
  report("Tirzepatide", "TR30", "153770", "Endotoxin", "https://janoshik.com/tests/153770-TR30_DQW81C1NHESG"),
  report("Tirzepatide", "TR40", "153775", "Content / Purity", "https://janoshik.com/tests/153775-TR40_676BFIDUUUP5"),
  report("Tirzepatide", "TR40", "153776", "Endotoxin", "https://janoshik.com/tests/153776-TR40_3IG4PA29V77W"),
];
