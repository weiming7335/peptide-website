import Image from "next/image";
import Link from "next/link";
import { PageHero } from "@/components/page-hero";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { products } from "@/lib/content";

export default function PeptidePage() {
  return <><SiteHeader /><main><PageHero title="Peptide" /><section className="catalog section-pad"><div className="section-shell catalog-layout"><aside><h3>Categories</h3><Link href="/peptide">Peptide <span>14 products</span></Link><Link href="/coa">Certificates of Analysis</Link></aside><div><div className="catalog-toolbar"><span>Showing all 14 results</span></div><div className="catalog-grid">{products.map(product => <article key={product.slug}><Link className="catalog-image" href={`/peptide/${product.slug}`}><Image src={product.image} alt={product.name} fill sizes="(max-width: 700px) 50vw, 25vw" /></Link><span>{product.category}</span><h2><Link href={`/peptide/${product.slug}`}>{product.name}</Link></h2><Link className="catalog-more" href={`/peptide/${product.slug}`}>Read more</Link></article>)}</div></div></div></section></main><SiteFooter /></>;
}
