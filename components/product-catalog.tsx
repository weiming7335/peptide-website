"use client";

import { useMemo, useState } from "react";
import { ProductCard } from "@/components/product-card";
import type { Product } from "@/lib/products";

export function ProductCatalog({ products }: { products: Product[] }) {
  const [query, setQuery] = useState("");
  const visibleProducts = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return products;
    return products.filter((product) => [product.name, ...product.specs.flatMap((item) => [item.code, item.presentation])].join(" ").toLowerCase().includes(term));
  }, [products, query]);

  return <>
    <div className="catalog-tools">
      <label>
        <span>Search the catalog</span>
        <input value={query} onChange={(event) => setQuery(event.target.value)} type="search" placeholder="Product name, code or specification" />
      </label>
      <p><strong>{visibleProducts.length}</strong> of {products.length} products</p>
    </div>
    {visibleProducts.length > 0
      ? <div className="product-grid catalog-grid">{visibleProducts.map((product) => <ProductCard product={product} key={product.slug} />)}</div>
      : <div className="empty-state"><h2>No matching product</h2><p>Try another product name, catalog code or specification.</p></div>}
  </>;
}
