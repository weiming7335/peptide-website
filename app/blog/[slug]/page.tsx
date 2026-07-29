import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHero } from "@/components/page-hero";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { articles, whatsappUrl } from "@/lib/content";

export function generateStaticParams() { return articles.map(({ slug }) => ({ slug })); }

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params; const article = articles.find(item => item.slug === slug); if (!article) notFound();
  return <><SiteHeader /><main><PageHero title="Research Resources" /><article className="article-page section-shell"><div className="article-cover"><Image src={article.image} alt={article.title} fill priority sizes="(max-width: 948px) 100vw, 900px" /></div><p className="article-date">{article.date}</p><h1>{article.title}</h1><p className="article-lead">{article.summary}</p>{article.sections.map(section => <section className="article-section" key={section.heading}><h2>{section.heading}</h2>{section.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}</section>)}<div className="article-quote"><h2>Looking for current batch documentation?</h2><p>Contact Christine to confirm the report for your selected specification.</p><a className="primary-button" href={whatsappUrl} target="_blank" rel="noreferrer">ASK CHRISTINE <span>→</span></a></div><Link className="back-link" href="/blog">← Back to Resources</Link></article></main><SiteFooter /></>;
}
