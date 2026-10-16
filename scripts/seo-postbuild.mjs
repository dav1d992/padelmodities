// Runs after `ng build`: writes sitemap.xml plus a static HTML entry per player
// so crawlers and link previews see player names without running JavaScript.
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const SITE_URL = "https://danskepadelmodities.com";
const SITE_NAME = "Danske Padelmodities";
const DATABASE_URL =
  "https://padelmodities-default-rtdb.europe-west1.firebasedatabase.app";
const DIST = path.join("dist", "danske-padelmodities");
// Ids and shortnames end up in file paths and URLs.
const SAFE_ID = /^[A-Za-z0-9_-]+$/;

const TEXT_TAGS =
  /\s*<(?:meta (?:name|property)="(?:description|og:title|og:description|og:url|twitter:title|twitter:description)"|link rel="canonical")[^>]*>/g;
const IMAGE_TAGS = /\s*<meta (?:name|property)="(?:og:image[\w:]*|twitter:image)"[^>]*>/g;
const FALLBACK = /<noscript id="seo-fallback">[\s\S]*?<\/noscript>/;

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const toJsonLd = (data) =>
  JSON.stringify({ "@context": "https://schema.org", ...data }).replace(/</g, "\\u003c");

let players = [];
try {
  const res = await fetch(`${DATABASE_URL}/players.json`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  players = Object.entries((await res.json()) ?? {})
    .filter(([id, p]) => SAFE_ID.test(id) && typeof p?.name === "string")
    .map(([id, p]) => ({ ...p, id }))
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
} catch (error) {
  // A home-page-only result is still better than failing the build.
  console.warn(`[seo] could not load players (${error.message})`);
}

const indexFile = path.join(DIST, "index.html");
const template = await readFile(indexFile, "utf8");

function playerPage(p) {
  const url = `${SITE_URL}/player/${p.id}`;
  const title = `${p.name} · ${SITE_NAME}`;
  const description =
    `${p.name} har en padel-rating på ${Math.round(p.rating ?? 0)} efter ` +
    `${p.matchesPlayed ?? 0} kampe og ${p.wins ?? 0} sejre. ` +
    `Se statistik og ratinghistorik hos ${SITE_NAME}.`;
  const portraitFile = `assets/optimized/${p.shortname}-padel.webp`;
  const portrait =
    typeof p.shortname === "string" &&
    SAFE_ID.test(p.shortname) &&
    existsSync(path.join(DIST, portraitFile))
      ? `${SITE_URL}/${portraitFile}`
      : null;

  const tags = [
    `<meta name="description" content="${escapeHtml(description)}">`,
    `<link rel="canonical" href="${url}">`,
    `<meta property="og:title" content="${escapeHtml(title)}">`,
    `<meta property="og:description" content="${escapeHtml(description)}">`,
    `<meta property="og:url" content="${url}">`,
    `<meta name="twitter:title" content="${escapeHtml(title)}">`,
    `<meta name="twitter:description" content="${escapeHtml(description)}">`,
  ];
  if (portrait) {
    tags.push(
      `<meta property="og:image" content="${portrait}">`,
      `<meta property="og:image:alt" content="${escapeHtml(p.name)}">`,
      `<meta name="twitter:image" content="${portrait}">`,
    );
  }
  tags.push(
    `<script type="application/ld+json">${toJsonLd({
      "@type": "ProfilePage",
      url,
      mainEntity: {
        "@type": "Person",
        name: p.name,
        ...(portrait && { image: portrait }),
        memberOf: { "@type": "SportsOrganization", name: SITE_NAME, url: SITE_URL },
      },
    })}</script>`,
  );

  let html = template
    .replace(/<title>[\s\S]*?<\/title>/, () => `<title>${escapeHtml(title)}</title>`)
    .replace(TEXT_TAGS, "");
  if (portrait) html = html.replace(IMAGE_TAGS, "");
  return html
    .replace("</head>", () => `  ${tags.join("\n  ")}\n</head>`)
    .replace(
      FALLBACK,
      () =>
        `<noscript id="seo-fallback"><h1>${escapeHtml(p.name)}</h1>` +
        `<p>${escapeHtml(description)}</p><p><a href="/">Se hele ranglisten</a></p></noscript>`,
    );
}

await mkdir(path.join(DIST, "player"), { recursive: true });
for (const p of players) {
  await writeFile(path.join(DIST, "player", `${p.id}.html`), playerPage(p));
}

if (players.length) {
  const list = players
    .map((p) => `<li><a href="/player/${p.id}">${escapeHtml(p.name)}</a></li>`)
    .join("");
  await writeFile(
    indexFile,
    template.replace(FALLBACK, (m) => m.replace("</noscript>", () => `<ul>${list}</ul></noscript>`)),
  );
}

const urls = [`${SITE_URL}/`, ...players.map((p) => `${SITE_URL}/player/${p.id}`)];
await writeFile(
  path.join(DIST, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map((u) => `  <url><loc>${u}</loc></url>`).join("\n") +
    `\n</urlset>\n`,
);
console.log(`[seo] ${players.length} player pages + sitemap (${urls.length} URLs) written`);
