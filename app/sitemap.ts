import type { MetadataRoute } from "next";
import { products } from "@/lib/products";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://jikepeptide.bio";
  const pages = ["", "/products", "/third-party-testing", "/services", "/request-a-quote", "/privacy", "/terms"];
  return [...pages.map((path) => ({ url: `${base}${path}`, lastModified: new Date() })), ...products.map((product) => ({ url: `${base}/products/${product.slug}`, lastModified: new Date() }))];
}
