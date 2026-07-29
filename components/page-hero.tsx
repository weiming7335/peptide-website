export function PageHero({ title, eyebrow = "JIKE PEPTIDE" }: { title: string; eyebrow?: string }) {
  return <section className="page-hero"><div className="section-shell"><span>{eyebrow}</span><h1>{title}</h1></div></section>;
}
