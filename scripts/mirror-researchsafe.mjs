import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const origin = "https://researchsafe.org";
const projectRoot = path.resolve(import.meta.dirname, "..");
const outputRoot = path.join(projectRoot, "researchsafe", "knowledge");
const seedHtml = await readFile("/tmp/researchsafe-knowledge.html", "utf8");

const peptidePaths = [
  ...new Set([...seedHtml.matchAll(/href="(\/peptides\/[^"]+)"/g)].map((match) => match[1])),
].sort();

const initialAssets = new Set([
  "/static/favicon-32.png",
  "/static/icon-192.png",
  "/static/apple-touch-icon.png",
  "/static/og-image.png",
  "/static/admin.js",
  "/static/analytics.js",
  "/static/app-boot.js",
  "/static/bridge.css",
  "/static/bridge.js",
  "/static/chat.js",
  "/static/data-bundle.js",
  "/static/forum.css",
  "/static/i18n.js",
  "/static/mobile-refresh.css",
  "/static/molecule-viewer.js",
  "/static/peptide-data.js",
  "/static/premium.css",
  "/static/premium.js",
  "/static/redesign.css",
  "/static/referral.js",
  "/static/social.js",
  "/static/style.css",
  "/static/structures-engine.js",
  "/static/ux-enhancements.js",
  "/static/vendor/fontawesome/css/all.min.css",
  "/static/vendor/fonts/fonts.css",
  "/static/vendor/three.module.js",
  "/static/warm-theme.css",
]);

function localPath(urlPath) {
  const cleanPath = urlPath.split("?")[0].replace(/^\/+/, "");
  return path.join(outputRoot, cleanPath);
}

async function fetchBuffer(urlPath) {
  let lastError;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const response = await fetch(`${origin}${urlPath}`, {
        headers: { "user-agent": "ResearchSafe-authorized-static-mirror/1.0" },
      });
      if (!response.ok) {
        const httpError = new Error(`${response.status} ${urlPath}`);
        httpError.noRetry = response.status >= 400 && response.status < 500;
        throw httpError;
      }
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      lastError = error;
      if (error.noRetry) throw error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 750));
    }
  }
  throw lastError;
}

async function save(urlPath, body) {
  const destination = localPath(urlPath);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, body);
}

async function parallelMap(items, concurrency, worker) {
  let next = 0;
  const runners = Array.from({ length: concurrency }, async () => {
    while (next < items.length) {
      const item = items[next++];
      await worker(item);
    }
  });
  await Promise.all(runners);
}

function pageDestination(urlPath) {
  if (urlPath === "/knowledge") return path.join(outputRoot, "index.html");
  return path.join(outputRoot, urlPath.replace(/^\/+/, ""), "index.html");
}

function collectAssets(html, assets) {
  for (const match of html.matchAll(/(?:src|href)=["'](\/static\/[^"'?#]+)(?:\?[^"']*)?["']/g)) {
    assets.add(match[1]);
  }
}

await mkdir(outputRoot, { recursive: true });
const assets = new Set(initialAssets);

await parallelMap(["/knowledge", ...peptidePaths], 3, async (urlPath) => {
  const destination = pageDestination(urlPath);
  if (urlPath !== "/knowledge") {
    try {
      await access(destination);
      collectAssets(await readFile(destination, "utf8"), assets);
      process.stdout.write(`page existing ${urlPath}\n`);
      return;
    } catch {
      // Download missing page.
    }
  }
  const html = urlPath === "/knowledge" ? seedHtml : (await fetchBuffer(urlPath)).toString("utf8");
  collectAssets(html, assets);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, html);
  process.stdout.write(`page ${urlPath}\n`);
});

// Preserve /knowledge links when the mirror is served with this folder as docroot.
await mkdir(path.join(outputRoot, "knowledge"), { recursive: true });
await writeFile(path.join(outputRoot, "knowledge", "index.html"), seedHtml);

await parallelMap([...assets].sort(), 3, async (assetPath) => {
  try {
    await access(localPath(assetPath));
    process.stdout.write(`asset existing ${assetPath}\n`);
    return;
  } catch {
    // Download missing asset.
  }
  try {
    const body = await fetchBuffer(assetPath);
    await save(assetPath, body);
    process.stdout.write(`asset ${assetPath}\n`);
  } catch (error) {
    process.stderr.write(`asset skipped ${error.message}\n`);
  }
});

// Download assets referenced from downloaded CSS and JS, including fonts.
const discovered = new Set();
for (const assetPath of assets) {
  if (!/\.(?:css|js)$/.test(assetPath)) continue;
  try {
    const text = await readFile(localPath(assetPath), "utf8");
    for (const match of text.matchAll(/["'(](\/static\/[^"'()?#\s]+)(?:\?[^"'()\s]*)?/g)) {
      if (!assets.has(match[1])) discovered.add(match[1]);
    }
    if (assetPath.endsWith(".css")) {
      for (const match of text.matchAll(/url\(["']?([^"'()]+)["']?\)/g)) {
        const value = match[1];
        if (/^(?:data:|https?:|#)/.test(value)) continue;
        const resolved = value.startsWith("/")
          ? value
          : path.posix.normalize(path.posix.join(path.posix.dirname(assetPath), value));
        if (resolved.startsWith("/static/") && !assets.has(resolved)) discovered.add(resolved);
      }
    }
  } catch {
    // Optional asset may have been unavailable.
  }
}

await parallelMap([...discovered].sort(), 3, async (assetPath) => {
  try {
    await access(localPath(assetPath));
    process.stdout.write(`asset existing ${assetPath}\n`);
    return;
  } catch {
    // Download missing asset.
  }
  try {
    await save(assetPath, await fetchBuffer(assetPath));
    process.stdout.write(`asset ${assetPath}\n`);
  } catch (error) {
    process.stderr.write(`asset skipped ${error.message}\n`);
  }
});

await writeFile(
  path.join(outputRoot, "MIRROR_INFO.txt"),
  [
    "ResearchSafe authorized static mirror",
    `Source: ${origin}/knowledge`,
    `Generated: ${new Date().toISOString()}`,
    `Detail pages: ${peptidePaths.length}`,
    "",
    "Serve this directory as the web root so /static and /peptides URLs resolve:",
    "python3 -m http.server 4173 --directory researchsafe/knowledge",
    "",
  ].join("\n"),
);

process.stdout.write(`done: ${peptidePaths.length} detail pages, ${assets.size + discovered.size} assets\n`);
