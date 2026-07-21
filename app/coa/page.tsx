import Image from "next/image";
import Link from "next/link";
import { PageHero } from "@/components/page-hero";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { certificates } from "@/lib/content";

export default function CoaPage() {
  return <><SiteHeader /><main><PageHero title="COA" /><section className="catalog section-pad"><div className="section-shell"><div className="catalog-toolbar"><span>Showing {certificates.length} certificates</span></div><div className="coa-grid">{certificates.map(item => <article key={item.slug}><Link className="coa-list-image" href={`/coa/${item.slug}`}><Image src={item.image} alt={`${item.name} Certificate of Analysis`} fill sizes="(max-width: 700px) 50vw, 25vw" /></Link><span>COA</span><h2><Link href={`/coa/${item.slug}`}>{item.name}</Link></h2><Link className="catalog-more" href={`/coa/${item.slug}`}>View certificate</Link></article>)}</div></div></section></main><SiteFooter /></>;
}
