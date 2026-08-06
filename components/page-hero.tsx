type PageHeroProps = {
  eyebrow: string;
  title: string;
  copy: string;
};

export function PageHero({ eyebrow, title, copy }: PageHeroProps) {
  return <section className="page-hero">
    <div className="shell page-hero-inner">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p>{copy}</p>
    </div>
  </section>;
}
