import Link from "next/link";
import { PageHero } from "@/components/page-hero";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { products } from "@/lib/content";
import { ProductVisual } from "@/components/product-visual";

export default function PeptidePage() {
  const categories = [...new Set(products.map(item=>item.category))];
  return <><SiteHeader /><main><PageHero title="Research product catalog" eyebrow="1 KIT MOQ · 10 VIALS PER KIT" /><section className="catalog section-pad"><div className="section-shell catalog-layout">
    <aside><h3>Categories</h3>{categories.map(category=><a href={`#${category.toLowerCase().replaceAll(" ","-")}`} key={category}>{category}<span>{products.filter(p=>p.category===category).length}</span></a>)}</aside>
    <div><div className="catalog-toolbar"><span>{products.length} products · specifications listed in popularity order</span><a href="#catalog-note">Research use only</a></div>
      <div className="catalog-grid">{products.map((item,index)=><article id={index===0?categories[0].toLowerCase().replaceAll(" ","-"):undefined} key={item.slug}><Link className="catalog-art" href={`/peptide/${item.slug}`}><ProductVisual item={item} /></Link><span>{item.category}</span><h2><Link href={`/peptide/${item.slug}`}>{item.name}</Link></h2><p>{item.specs.join(" · ")}</p><Link className="catalog-more" href={`/peptide/${item.slug}`}>Specifications →</Link></article>)}</div>
      <p id="catalog-note" className="catalog-note">All catalog products are supplied strictly for laboratory research and analytical use. Not for human consumption.</p>
    </div>
  </div></section></main><SiteFooter /></>;
}
