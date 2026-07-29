import Image from "next/image";
import { assetPath } from "@/lib/site-config";
import type { Product } from "@/lib/content";

export function ProductVisual({ item, detail = false }: { item: Product; detail?: boolean }) {
  return <div className={`product-visual${detail ? " product-visual-detail" : ""}`}>
    <Image
      src={assetPath("/images/jike/product-vials-red.jpg")}
      alt={`${item.name} research kit presentation`}
      fill
      sizes={detail ? "(max-width: 900px) 100vw, 50vw" : "(max-width: 700px) 50vw, 25vw"}
    />
    <div className="vial-label-overlay">
      <small>JP · RESEARCH USE ONLY</small>
      <strong>{item.name}</strong>
      <span>{item.specs[0]} · 10 VIALS / KIT</span>
    </div>
    <b className="product-code">{item.codes[0]}</b>
  </div>;
}
