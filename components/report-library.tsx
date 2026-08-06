"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import type { TestReport } from "@/lib/reports";

export function ReportLibrary({ reports }: { reports: TestReport[] }) {
  const [query, setQuery] = useState("");
  const visibleReports = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return reports;
    return reports.filter((report) => `${report.product} ${report.sample} ${report.reportNumber} ${report.type}`.toLowerCase().includes(term));
  }, [query, reports]);

  return <>
    <div className="catalog-tools testing-tools">
      <label>
        <span>Find a report</span>
        <input value={query} onChange={(event) => setQuery(event.target.value)} type="search" placeholder="Product, sample or report number" />
      </label>
      <p><strong>{visibleReports.length}</strong> reports</p>
    </div>
    <div className="report-grid">
      {visibleReports.map((report) => <article className="report-card" key={report.reportNumber}>
        <a className="report-preview" href={report.image} target="_blank" rel="noreferrer">
          <Image src={report.image} alt={`Janoshik report ${report.reportNumber}`} width={520} height={767} />
        </a>
        <div className="report-card-body">
          <span>{report.type}</span>
          <h2>{report.product}</h2>
          <dl><div><dt>Sample</dt><dd>{report.sample}</dd></div><div><dt>Report</dt><dd>#{report.reportNumber}</dd></div></dl>
          <a className="text-link" href={report.verificationUrl} target="_blank" rel="noreferrer">Verify on Janoshik ↗</a>
        </div>
      </article>)}
    </div>
  </>;
}
