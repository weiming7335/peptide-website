import Image from "next/image";
import Link from "next/link";
import { PageHero } from "@/components/page-hero";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { articles } from "@/lib/content";

export default function BlogPage() {
  return <><SiteHeader /><main><PageHero title="Blog" /><section className="section-pad"><div className="section-shell blog-list">{articles.map(article => <article key={article.slug}><Link className="blog-list-image" href={`/blog/${article.slug}`}><Image src={article.image} alt={article.title} fill sizes="(max-width: 640px) 50vw, 33vw" /></Link><div><span>{article.date}</span><h2><Link href={`/blog/${article.slug}`}>{article.title}</Link></h2><p>{article.summary}</p><Link className="catalog-more" href={`/blog/${article.slug}`}>Read More</Link></div></article>)}</div></section></main><SiteFooter /></>;
}
