import type { Metadata } from "next";
import { ProductCatalog } from "@/components/product-catalog";
import { products } from "@/lib/products";

export const metadata: Metadata = { title: "Products", description: "Browse all 42 Jike Peptide catalog products, specifications and downloadable product data sheets." };

export default function ProductsPage() {
  return <section className="section catalog-section"><div className="shell"><header className="page-intro-block"><div><p className="eyebrow">42 CATALOG PRODUCTS</p><h1>Product catalog.</h1></div><p>Compare specifications, open full product information and download each data sheet. Pricing and availability are confirmed by inquiry.</p></header><ProductCatalog products={products} /></div></section>;
}
