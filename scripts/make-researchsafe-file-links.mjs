import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..", "researchsafe", "knowledge");
const indexPaths = [
  path.join(root, "index.html"),
  path.join(root, "knowledge", "index.html"),
];

function rewriteExternalRootLinks(html, pagePrefix) {
  return html.replace(
    /((?:href|action)=["'])\/(?!static\/|peptides\/|knowledge(?:["'/?#])|$)([^"']*)(["'])/g,
    `$1https://researchsafe.org/$2$3`,
  ).replace(/href=(["'])\/\1/g, `href=$1${pagePrefix}index.html$1`);
}

function makeStatic(html, prefix) {
  const staticStyles = [
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
    .map((asset) => `  <link rel="stylesheet" href="${prefix}static/${asset}">`)
    .join("\n");

  if (!html.includes('data-static-mirror="researchsafe"')) {
    html = html.replace(
      "</head>",
      `  <meta data-static-mirror="researchsafe">\n${staticStyles}\n</head>`,
    );
  }

  // The original boot bundle replaces the complete SSR HTML with an API-driven
  // app. The mirror keeps the already-rendered HTML and needs no backend.
  return html.replace(
    /\s*<script>window\.__SSR_VIEW__=[\s\S]*?<\/script>\s*<\/body>/,
    "\n</body>",
  );
}

for (const indexPath of indexPaths) {
  let html = await readFile(indexPath, "utf8");
  const inKnowledgeAlias = path.relative(root, indexPath).startsWith(`knowledge${path.sep}`);
  const prefix = inKnowledgeAlias ? "../" : "";
  if (!inKnowledgeAlias) {
    html = html
      .replace(/(["'])\.\.\/static\//g, "$1static/")
      .replace(/href=(["'])\.\.\/peptides\//g, "href=$1peptides/")
      .replace(/href=(["'])\.\.\/index\.html\1/g, "href=$1index.html$1");
  }
  html = html
    .replace(/(["'])\/static\//g, `$1${prefix}static/`)
    .replace(/href=(["'])\/peptides\/([^"'/?#]+)\/?\1/g, `href=$1${prefix}peptides/$2/index.html$1`)
    .replace(/href=(["'])\/knowledge\/?\1/g, `href=$1${prefix}index.html$1`);
  html = rewriteExternalRootLinks(html, prefix);
  html = makeStatic(html, prefix);
  await writeFile(indexPath, html);
}

const peptideRoot = path.join(root, "peptides");
const peptideDirectories = await import("node:fs/promises").then(({ readdir }) =>
  readdir(peptideRoot, { withFileTypes: true }),
);

for (const entry of peptideDirectories) {
  if (!entry.isDirectory()) continue;
  const htmlPath = path.join(peptideRoot, entry.name, "index.html");
  let html = await readFile(htmlPath, "utf8");
  html = html
    .replace(/(["'])\/static\//g, "$1../../static/")
    .replace(/href=(["'])\/peptides\/([^"'/?#]+)\/?\1/g, "href=$1../$2/index.html$1")
    .replace(/href=(["'])\/knowledge\/?\1/g, "href=$1../../index.html$1");
  html = rewriteExternalRootLinks(html, "../../");
  html = makeStatic(html, "../../");
  await writeFile(htmlPath, html);
}

process.stdout.write(`rewrote file links in ${peptideDirectories.filter((entry) => entry.isDirectory()).length + 2} HTML files\n`);
