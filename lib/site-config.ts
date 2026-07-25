export const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
export const companyName = "Guangzhou Leaxion Peptide Industry Co., Ltd";

export function assetPath(path: string) {
  return `${basePath}${path}`;
}
