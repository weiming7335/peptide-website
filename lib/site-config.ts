export const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
export const companyName = "Jike Biotech (Guangzhou) Co., Ltd.";
export const brandName = "Jike Peptide";
export const domain = "https://jikepeptide.bio";

export function assetPath(path: string) {
  return `${basePath}${path}`;
}
