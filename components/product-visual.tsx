import Image from "next/image";
import { assetPath } from "@/lib/site-config";
import type { Product } from "@/lib/content";

export function ProductVisual({ item, detail = false }: { item: Product; detail?: boolean }) {
  return <div className={`product-visual${detail ? " product-visual-detail" : ""}`}>
    <Image
      src={assetPath("/images/jike/catalog-vial-blue.jpg")}
      alt={`${item.name} research kit presentation`}
      fill
      sizes={detail ? "(max-width: 900px) 100vw, 50vw" : "(max-width: 700px) 50vw, 25vw"}
    />
    <div className="vial-label-overlay">
      <Image className="vial-brand-mark" src={assetPath("/images/jike/jp-mark-blue.jpg")} alt="" width={24} height={24} />
      <small>JIKE PEPTIDE</small>
      <strong>{item.name}</strong>
      <span>{item.specs[0]} · 10 VIALS / KIT</span>
      <em>RESEARCH USE ONLY</em>
    </div>
    <b className="product-code">{item.codes[0]}</b>
  </div>;
}
