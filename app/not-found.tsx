import Link from "next/link";
export default function NotFound() { return <section className="not-found shell"><p className="eyebrow">404</p><h1>Page not found.</h1><p>The page may have moved during the website rebuild.</p><Link className="button" href="/">Return home</Link></section>; }
