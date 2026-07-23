import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const origin = "https://researchsafe.org";
const projectRoot = path.resolve(import.meta.dirname, "..");
const outputRoot = path.join(projectRoot, "researchsafe", "protocols");
const baseHtml = await readFile("/tmp/researchsafe-protocols.html", "utf8");

global.window = {};
await import(path.join(projectRoot, "researchsafe", "knowledge", "static", "data-bundle.js"));
const protocols = window.__INLINE_DATA__.protocols;

const esc = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

function shell(content, prefix, title) {
  const staticPrefix = `${prefix}../knowledge/static/`;
  const styles = [
    "vendor/fonts/fonts.css",
    "vendor/fontawesome/css/all.min.css",
    "style.css",
    "redesign.css",
    "bridge.css",
    "forum.css",
    "premium.css",
    "mobile-refresh.css",
    "warm-theme.css",
  ]
    .map((asset) => `  <link rel="stylesheet" href="${staticPrefix}${asset}">`)
    .join("\n");

  let html = baseHtml
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)} | ResearchSafe</title>`)
    .replace(
      /<div class="content-area" id="contentArea">[\s\S]*?<\/div>\s*<\/main>/,
      `<div class="content-area" id="contentArea">${content}</div>\n    </main>`,
    )
    .replace(
      /\s*<script>window\.__SSR_VIEW__=[\s\S]*?<\/script>\s*<\/body>/,
      "\n</body>",
    )
    .replace("</head>", `  <meta data-static-mirror="researchsafe-protocols">\n${styles}\n</head>`)
    .replace(/(["'])\/static\//g, `$1${staticPrefix}`)
    .replace(/href=(["'])\/\1/g, `href=$1${prefix}../knowledge/index.html$1`)
    .replace(
      /((?:href|action)=["'])\/(?!static\/|protocols\/|peptides\/)([^"']*)(["'])/g,
      `$1${origin}/$2$3`,
    );
  return html;
}

function listContent() {
  const categories = [...new Set(protocols.map((item) => item.category).filter(Boolean))].sort();
  const cards = protocols
    .map(
      (item) => `
        <a class="protocol-card ripple-container" href="${esc(item.id)}/index.html" data-category="${esc(item.category)}" data-search="${esc(
          [item.name, item.description, item.goal, item.category, ...item.peptides].join(" ").toLowerCase(),
        )}" style="display:block;text-decoration:none;color:inherit">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px">
            <div class="proto-name">${esc(item.name)}</div>
            <span style="font-size:10px;font-weight:600;color:#2563eb;background:#eff6ff;border:1px solid #bfdbfe;padding:2px 8px;border-radius:999px;white-space:nowrap;flex-shrink:0">${esc(item.category)}</span>
          </div>
          <div class="proto-desc">${esc(item.description)}</div>
          <div style="display:flex;gap:6px;align-items:flex-start;margin-top:8px;font-size:12px;color:#15803d"><i class="fas fa-bullseye" style="margin-top:2px;flex-shrink:0"></i><span>${esc(item.goal)}</span></div>
          <div class="proto-meta" style="margin-top:10px">
            <span><i class="fas fa-clock"></i> ${esc(item.duration)}</span>
            <span><i class="fas fa-flask"></i> ${item.peptides.length} compounds</span>
          </div>
          <div class="detail-tags" style="margin-top:8px">${item.peptides
            .slice(0, 5)
            .map((name) => `<span class="detail-tag" style="font-size:10px">${esc(name)}</span>`)
            .join("")}</div>
        </a>`,
    )
    .join("");

  return `
    <div class="protocols-view">
      <div class="page-hero page-hero-blue">
        <div class="page-hero-bg"><div class="ph-orb ph-orb1"></div><div class="ph-orb ph-orb2"></div><div class="ph-orb ph-orb3"></div><div class="ph-grid"></div></div>
        <div class="page-hero-body">
          <div class="ph-icon" style="background:rgba(59,130,246,.2);border-color:rgba(59,130,246,.3);color:#60a5fa"><i class="fas fa-clipboard-list"></i></div>
          <div class="ph-text"><h1 class="ph-title">Protocol Templates</h1><p class="ph-sub">Structured research protocols with per-compound dosing, goals, and practical schedules. Tap any protocol for full dosing detail.</p></div>
          <div class="ph-stats">
            <div class="ph-stat"><div class="ph-stat-n">${protocols.length}</div><div class="ph-stat-l">Protocols</div></div>
            <div class="ph-stat"><div class="ph-stat-n">${categories.length}</div><div class="ph-stat-l">Categories</div></div>
            <div class="ph-stat"><div class="ph-stat-n">Phased</div><div class="ph-stat-l">Dosing</div></div>
          </div>
        </div>
      </div>
      <div class="proto-controls" style="display:flex;flex-direction:column;gap:12px;margin:18px 0 8px">
        <div class="proto-search" style="position:relative"><i class="fas fa-search" style="position:absolute;left:14px;top:50%;transform:translateY(-50%);color:var(--text-secondary);font-size:13px"></i><input id="protoSearch" type="text" placeholder="Search protocols, goals, or compounds..." style="width:100%;padding:11px 14px 11px 38px;border:1px solid var(--border);border-radius:11px;font-size:14px;background:var(--bg-card,#fff);color:var(--text-primary)"></div>
        <div class="proto-cat-bar" style="display:flex;gap:8px;flex-wrap:wrap"><button class="proto-cat-pill active" data-cat="all">All</button>${categories
          .map((category) => `<button class="proto-cat-pill" data-cat="${esc(category)}">${esc(category)}</button>`)
          .join("")}</div>
      </div>
      <div id="protoGrid">${cards}</div>
    </div>
    <div class="disclaimer"><i class="fas fa-info-circle" style="margin-right:4px"></i> ResearchSafe is a research assistant. All information is for educational and research purposes only.</div>
    <script>
      (() => {
        const cards = [...document.querySelectorAll(".protocol-card")];
        const search = document.getElementById("protoSearch");
        let category = "all";
        const filter = () => {
          const query = search.value.trim().toLowerCase();
          cards.forEach(card => {
            card.style.display = (category === "all" || card.dataset.category === category) && (!query || card.dataset.search.includes(query)) ? "block" : "none";
          });
        };
        search.addEventListener("input", filter);
        document.querySelectorAll(".proto-cat-pill").forEach(button => button.addEventListener("click", () => {
          category = button.dataset.cat;
          document.querySelectorAll(".proto-cat-pill").forEach(item => item.classList.toggle("active", item === button));
          filter();
        }));
      })();
    </script>`;
}

function detailContent(protocol) {
  const compounds = Array.isArray(protocol.compounds) ? protocol.compounds : [];
  const cards = compounds
    .filter((compound) => compound.found && compound.dosing)
    .map((compound) => {
      const dosing = compound.dosing;
      const row = (icon, label, value) =>
        value
          ? `<div style="display:flex;gap:8px;font-size:12.5px;margin-bottom:6px;line-height:1.5"><span style="color:var(--text-secondary);min-width:78px;font-weight:600"><i class="fas ${icon}" style="color:#2563eb;margin-right:5px"></i>${label}</span><span style="color:var(--text-primary)">${esc(value)}</span></div>`
          : "";
      const steps = Array.isArray(dosing.protocol)
        ? `<div style="margin-top:8px"><div style="font-size:11px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.3px;margin-bottom:4px">How it's commonly run</div><ul style="margin:0;padding-left:18px;font-size:12px;color:var(--text-secondary);line-height:1.55">${dosing.protocol
            .map((step) => `<li>${esc(step)}</li>`)
            .join("")}</ul></div>`
        : "";
      return `<div class="proto-compound-card" style="border:1px solid var(--border);border-radius:12px;padding:14px 16px;margin-bottom:12px;background:var(--bg-card,#fff)">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px">
          <a href="../../knowledge/peptides/${esc(compound.id)}/index.html" style="font-size:15px;font-weight:700;color:#2563eb;text-decoration:none">${esc(compound.name)} <i class="fas fa-arrow-up-right-from-square" style="font-size:10px;opacity:.6"></i></a>
          <span style="font-size:10px;font-weight:600;color:${esc(compound.categoryColor || "#6b7280")};background:rgba(0,0,0,.04);padding:2px 8px;border-radius:999px;white-space:nowrap">${esc(compound.category)}</span>
        </div>
        ${row("fa-syringe", "Typical", dosing.typical)}
        ${row("fa-repeat", "Frequency", dosing.frequency)}
        ${row("fa-calendar-days", "Duration", dosing.duration)}
        ${row("fa-route", "Route", dosing.route)}
        ${row("fa-clock", "Timing", dosing.timing)}
        ${row("fa-rotate", "Cycle", dosing.cycle)}
        ${steps}
      </div>`;
    })
    .join("");

  return `<div class="protocol-detail">
    <a class="back-btn" href="../index.html" style="display:inline-flex;text-decoration:none"><i class="fas fa-arrow-left"></i> Back to Protocols</a>
    <h1 style="font-size:24px;font-weight:700;margin:16px 0 6px;letter-spacing:-.3px">${esc(protocol.name)}</h1>
    <div style="display:inline-block;font-size:11px;font-weight:600;color:#2563eb;background:#eff6ff;border:1px solid #bfdbfe;padding:3px 10px;border-radius:999px;margin-bottom:10px">${esc(protocol.category)}</div>
    <p style="font-size:14px;color:var(--text-secondary);line-height:1.6;margin-bottom:12px">${esc(protocol.description)}</p>
    <div style="display:flex;gap:16px;margin-bottom:16px;flex-wrap:wrap">
      <span style="font-size:12px;color:var(--text-secondary)"><i class="fas fa-clock" style="color:#2563eb"></i> ${esc(protocol.duration)}</span>
      <span style="font-size:12px;color:var(--text-secondary)"><i class="fas fa-flask" style="color:#8b5cf6"></i> ${compounds.length} compounds</span>
    </div>
    <div style="display:flex;align-items:flex-start;gap:10px;padding:14px 16px;border-radius:12px;background:#f0fdf4;border:1px solid #bbf7d0;margin-bottom:18px"><i class="fas fa-bullseye" style="color:#16a34a;margin-top:2px"></i><div><div style="font-size:11px;font-weight:700;color:#15803d;text-transform:uppercase;letter-spacing:.4px;margin-bottom:2px">Goal</div><div style="font-size:13px;color:#166534;line-height:1.5">${esc(protocol.goal)}</div></div></div>
    <div class="detail-section-title" style="font-size:15px;font-weight:700;margin-bottom:12px">Dosing by Compound</div>
    ${cards}
    <div style="padding:12px 16px;border-radius:11px;background:#eff6ff;border:1px solid #bfdbfe;margin-top:20px"><p style="font-size:11px;color:#1e3a8a;line-height:1.55"><strong>Disclaimer:</strong> This protocol template combines per-compound dosing references for educational and research purposes only. It is not medical advice. Consult a licensed medical professional before using any compound.</p></div>
  </div>`;
}

async function fetchProtocol(id) {
  const response = await fetch(`${origin}/api/protocols/${encodeURIComponent(id)}`);
  if (!response.ok) throw new Error(`${response.status} ${id}`);
  return response.json();
}

await mkdir(outputRoot, { recursive: true });
await writeFile(path.join(outputRoot, "index.html"), shell(listContent(), "", "Protocol Templates"));

for (const summary of protocols) {
  const protocol = await fetchProtocol(summary.id);
  const directory = path.join(outputRoot, summary.id);
  await mkdir(directory, { recursive: true });
  await writeFile(
    path.join(directory, "index.html"),
    shell(detailContent(protocol), "../", protocol.name),
  );
  process.stdout.write(`protocol ${summary.id}\n`);
}

process.stdout.write(`done: ${protocols.length} protocol detail pages\n`);
