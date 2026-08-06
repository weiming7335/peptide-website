import type { Metadata } from "next";
import { ReportLibrary } from "@/components/report-library";
import { reports } from "@/lib/reports";

export const metadata: Metadata = { title: "Third-Party Testing", description: "Browse 34 public Janoshik content, purity and endotoxin test reports with original verification links." };

export default function TestingPage() {
  return <section className="section testing-library-section"><div className="shell">
    <header className="page-intro-block"><div><p className="eyebrow">34 PUBLIC REPORTS</p><h1>Third-party testing.</h1></div><p>Review Janoshik reports by product, sample code or task number. Every report links to the laboratory’s original verification page.</p></header>
    <aside className="testing-context"><div><span>SHARED-COST COORDINATION</span><strong>Customers may participate in selected third-party tests and share the total laboratory cost.</strong></div><p>Reports represent the specific samples identified in each document and are not blanket claims for every product or future batch.</p></aside>
    <ReportLibrary reports={reports} />
  </div></section>;
}
