import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/lib/products";

export function ProductCard({ product }: { product: Product }) {
  return <Link className="product-card" href={`/products/${product.slug}`}>
    <div className="product-card-image">
      <Image src={product.image} alt={`${product.name} product presentation`} width={620} height={620} />
    </div>
    <div className="product-card-body">
      <span>{product.specs.length} {product.specs.length === 1 ? "specification" : "specifications"}</span>
      <h2>{product.name}</h2>
      <p>{product.specs.map((item) => item.presentation.split(" x ")[0]).join(" · ")}</p>
      <strong>View product <span aria-hidden="true">↗</span></strong>
    </div>
  </Link>;
}
