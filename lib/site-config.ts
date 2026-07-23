export const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
export const companyName = "Hong Kong Leaxion Peptide Industry Co., Ltd";

export function assetPath(path: string) {
  return `${basePath}${path}`;
}
