// KRIPH · API + servidor "raw" en una sola función de Netlify.
//   POST /api/save    {user,key,name,code}  -> publica/actualiza un script
//   POST /api/delete  {user,key,name}       -> borra un script
//   GET  /raw/<usuario>/<script>/main       -> devuelve el código en texto plano (para HttpGet)
//        (con protección anti-volcado: ver bloque PROTECCIÓN más abajo)
import { createHash, timingSafeEqual } from "node:crypto";

export const config = { path: ["/api/*", "/raw/*"] };


// =====================================================================
//  PROTECCIÓN ANTI-VOLCADO DE /raw/
//  - Navegadores y previsualizadores (Discord, WhatsApp, etc.) -> pantalla "protegido"
//  - Herramientas (curl, python, node, bots, scrapers...)      -> código basura
//  - Demasiadas peticiones desde la misma IP                    -> código basura
//  - Todo lo bloqueado se responde ANTES de buscar el script, así que
//    se ve igual exista o no el script.
// =====================================================================
const BLOCK_HTML = "<!doctype html>\n<html lang=\"es\">\n<head>\n<meta charset=\"utf-8\">\n<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">\n<meta name=\"robots\" content=\"noindex,nofollow\">\n<meta name=\"color-scheme\" content=\"dark\">\n<meta property=\"og:title\" content=\"KRIPH\">\n<meta property=\"og:description\" content=\"Este script está protegido y no tienes autorización de extraerlo\">\n<meta name=\"description\" content=\"Este script está protegido y no tienes autorización de extraerlo\">\n<title>KRIPH</title>\n<link rel=\"icon\" href=\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Ccircle cx='32' cy='32' r='30.5' fill='%23fff'/%3E%3Cpath fill='%23000' d='M14.5 9.5 27 19.6Q32 18.6 37 19.6L49.5 9.5 51.6 31Q53 36 49.5 42 43 53.5 32 53.5 21 53.5 14.5 42 11 36 12.4 31z'/%3E%3Cpath fill='none' stroke='%23fff' stroke-width='1.8' d='M10.5 28.3 27.8 19.3M53.5 28.3 36.2 19.3'/%3E%3Cpath fill='%23fff' d='M18.5 35 30 36.5 27 41zM45.5 35 34 36.5 37 41z'/%3E%3C/svg%3E\">\n<link rel=\"preconnect\" href=\"https://fonts.googleapis.com\">\n<link rel=\"preconnect\" href=\"https://fonts.gstatic.com\" crossorigin>\n<link rel=\"stylesheet\" href=\"https://fonts.googleapis.com/css2?family=Unbounded:wght@300;900&family=DM+Sans:wght@400;500;600&family=Outfit:wght@500;600;700&display=swap\">\n<style>\n*{box-sizing:border-box;margin:0}\nhtml,body{height:100%}\nbody{background:#000;color:#f4f5f7;font-family:\"DM Sans\",\"Helvetica Neue\",Arial,sans-serif;display:flex;align-items:center;justify-content:center;padding:24px;overflow:hidden}\nbody:before{content:\"\";position:fixed;inset:0;background:radial-gradient(60% 45% at 50% 40%,rgba(255,255,255,.07),transparent 70%);pointer-events:none}\n.card{position:relative;width:min(420px,100%);text-align:center;padding:34px 28px 30px;background:#0a0a0b;border:1px solid #1d1e22;border-radius:22px;box-shadow:0 30px 80px rgba(0,0,0,.7)}\n.logo{display:inline-flex;align-items:center;gap:10px;font:700 23px/1 \"Outfit\",\"Helvetica Neue\",Arial,sans-serif;letter-spacing:-.03em;margin-bottom:30px}\n.logo svg{width:40px;height:40px;color:#fff}\n.skull{width:92px;height:92px;margin:0 auto 24px;display:block;color:#f4f5f7;filter:drop-shadow(0 0 18px rgba(255,255,255,.25));animation:flota 3.5s ease-in-out infinite}\n@keyframes flota{50%{transform:translateY(-6px)}}\nh1{font-size:17px;font-weight:600;line-height:1.45;margin-bottom:10px}\np{font-size:13.5px;color:#9298a5;line-height:1.5}\n.tag{display:inline-block;margin-top:24px;padding:7px 14px;border:1px solid #1d1e22;border-radius:999px;font-size:11px;letter-spacing:.12em;color:#9298a5;background:#111113}\n@media (prefers-reduced-motion:reduce){.skull{animation:none}}\n</style>\n</head>\n<body>\n<main class=\"card\">\n  <div class=\"logo\">\n    <svg viewBox=\"0 0 64 64\" aria-hidden=\"true\"><circle cx=\"32\" cy=\"32\" r=\"30.5\" fill=\"currentColor\"/><path fill=\"#000000\" d=\"M14.5 9.5 27 19.6Q32 18.6 37 19.6L49.5 9.5 51.6 31Q53 36 49.5 42 43 53.5 32 53.5 21 53.5 14.5 42 11 36 12.4 31z\"/><path fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" d=\"M10.5 28.3 27.8 19.3M53.5 28.3 36.2 19.3\"/><path fill=\"currentColor\" d=\"M18.5 35 30 36.5 27 41zM45.5 35 34 36.5 37 41z\"/></svg>\n    KRIPH\n  </div>\n  <svg class=\"skull\" viewBox=\"0 0 64 64\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\">\n    <path d=\"M32 6C18.7 6 9 15.4 9 27.5c0 7.2 3.4 12.2 8 15.3V52a3 3 0 0 0 3 3h24a3 3 0 0 0 3-3v-9.2c4.6-3.1 8-8.1 8-15.3C55 15.4 45.3 6 32 6z\"/>\n    <circle cx=\"23\" cy=\"29\" r=\"5.5\" fill=\"currentColor\"/>\n    <circle cx=\"41\" cy=\"29\" r=\"5.5\" fill=\"currentColor\"/>\n    <path d=\"M32 36l-3.2 6h6.4z\" fill=\"currentColor\"/>\n    <path d=\"M24 55v-6M32 55v-6M40 55v-6\"/>\n  </svg>\n  <h1>Este script está protegido y no tienes autorización de extraerlo</h1>\n  <p>El acceso desde navegadores, bots y herramientas de volcado está bloqueado.</p>\n  <span class=\"tag\">ACCESO DENEGADO</span>\n</main>\n</body>\n</html>\n";

const ALLOW_EMPTY_UA = process.env.KRIPH_ALLOW_EMPTY_UA === "1"; // pon 1 en Netlify si Delta llega sin User-Agent
const RATE_MAX = Number(process.env.KRIPH_RATE_MAX || 30);       // peticiones permitidas por IP...
const RATE_WINDOW_MS = 60 * 1000;                                 // ...cada 60 segundos
const rate = new Map();

const PREVIEW_BOTS = /discord|telegram|whatsapp|slackbot|slack-img|twitterbot|facebookexternalhit|facebot|linkedinbot|skypeuripreview|embedly|pinterest|redditbot|vkshare|tumblr|mastodon|bluesky|bsky|signal|line\//i;
const TOOLS = /^node\b|^deno|^bun\b|curl|wget|python|aiohttp|httpx|urllib|requests|node-fetch|undici|axios|\bgot\b|superagent|needle|go-http-client|libwww|perl|ruby|php|scrapy|postman|insomnia|httpie|paw\/|powershell|winhttp|apache-httpclient|java\/|jersey|reqwest|hyper|guzzle|okhttp\/[0-9.]+ \(compatible|bot|crawl|spider|scrape|fetch|monitor|headless|phantom|selenium|puppeteer|playwright|lighthouse|archive|wayback|scanner|probe|check|dump|grab|download|http-client|httpclient|fiddler|burp|mitm|charles|proxy|sandbox|virustotal|any\.run|hybrid-analysis|urlscan|safebrowsing/i;

const ipOf = (req) =>
  (req.headers.get("x-nf-client-connection-ip") ||
    (req.headers.get("x-forwarded-for") || "").split(",")[0] ||
    "x").trim();

function limited(ip) {
  const now = Date.now();
  if (rate.size > 5000) for (const [k, v] of rate) if (now - v.t > RATE_WINDOW_MS) rate.delete(k);
  let r = rate.get(ip);
  if (!r || now - r.t > RATE_WINDOW_MS) { r = { c: 0, t: now }; rate.set(ip, r); }
  r.c++;
  return r.c > RATE_MAX;
}

function classify(req) {
  const h = req.headers;
  const ua = h.get("user-agent") || "";
  const accept = h.get("accept") || "";
  if (PREVIEW_BOTS.test(ua)) return "preview";
  if (
    h.has("sec-fetch-mode") || h.has("sec-fetch-dest") || h.has("sec-fetch-site") || h.has("sec-fetch-user") ||
    h.has("upgrade-insecure-requests") || /text\/html|application\/xhtml/i.test(accept) ||
    (/mozilla|applewebkit|chrome|safari|firefox|edg\//i.test(ua) && h.has("accept-language"))
  ) return "browser";
  if (TOOLS.test(ua)) return "tool";
  if (!ua && !ALLOW_EMPTY_UA) return "tool";
  if (h.has("x-forwarded-host") && h.has("via")) return "tool";
  return "ok";
}

const blockPage = (status) =>
  new Response(BLOCK_HTML, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store, no-cache, must-revalidate, private",
      "x-robots-tag": "noindex, nofollow, noarchive",
      "x-content-type-options": "nosniff",
    },
  });

// ---- código basura (Lua válido pero inútil, distinto en cada petición)
const R = (n) => Math.floor(Math.random() * n);
const ID = () => {
  const k = "abcdefghijklmnopqrstuvwxyz";
  const styles = [
    () => "_0x" + R(0xfffff).toString(16).padStart(5, "0"),
    () => "l" + "Il1O0"[R(5)] + "Il1O0lI"[R(7)] + "Il1O0lI1"[R(8)] + R(999),
    () => k[R(26)] + k[R(26)] + k[R(26)] + R(9999),
    () => "_" + k[R(26)].toUpperCase() + R(99999),
  ];
  return styles[R(styles.length)]();
};
const HEX = (n) => Array.from({ length: n }, () => "0123456789abcdef"[R(16)]).join("");
const ESC = (s) => Array.from(s).map((c) => "\\" + c.charCodeAt(0)).join("");
const NUMS = (n, m) => Array.from({ length: n }, () => R(m)).join(", ");

function junkBlock() {
  const a = ID(), b = ID(), c = ID(), d = ID(), e = ID();
  const t = R(6);
  if (t === 0)
    return [
      "do",
      "    local " + a + " = {" + NUMS(8 + R(8), 65535) + "}",
      "    local " + b + " = 0",
      "    for " + c + " = 1, #" + a + " do",
      "        " + b + " = (" + b + " + " + a + "[" + c + "] * " + (3 + R(90)) + ") % " + (251 + R(60000)),
      "    end",
      "    local " + d + " = function(" + e + ") return (" + e + " + " + b + ") % " + (97 + R(900)) + " end",
      "end",
    ].join("\n");
  if (t === 1)
    return [
      "do",
      "    local " + a + " = \"" + ESC(HEX(10 + R(14))) + "\"",
      "    local " + b + " = {}",
      "    for " + c + " = 1, #" + a + " do",
      "        " + b + "[#" + b + " + 1] = string.byte(" + a + ", " + c + ") + " + R(40),
      "    end",
      "    local " + d + " = table.concat(" + b + ", \"" + HEX(2) + "\")",
      "end",
    ].join("\n");
  if (t === 2)
    return [
      "local function " + a + "(" + b + ", " + c + ")",
      "    local " + d + " = " + R(5000),
      "    for " + e + " = 1, " + (3 + R(6)) + " do",
      "        " + d + " = math.floor(" + d + " / " + (2 + R(6)) + ") + ((" + b + " or 0) % " + (2 + R(9)) + ")",
      "        if " + d + " % " + (2 + R(9)) + " == 0 then " + d + " = " + d + " + ((" + c + " or 1) % 7) end",
      "    end",
      "    return " + d + " ~= nil and " + d + " or " + R(100),
      "end",
      a + "(" + R(500) + ", " + R(500) + ")",
    ].join("\n");
  if (t === 3)
    return [
      "do",
      "    local " + a + " = setmetatable({}, {",
      "        __index = function(" + b + ", " + c + ") return #tostring(" + c + ") * " + R(999) + " end,",
      "        __newindex = function() end,",
      "        __call = function(" + d + ", " + e + ") return " + e + " end,",
      "    })",
      "    local " + b + " = " + a + "." + ID() + " + " + R(100),
      "end",
    ].join("\n");
  if (t === 4)
    return [
      "do",
      "    local " + a + " = {",
      "        [\"" + HEX(8) + "\"] = " + R(99999) + ",",
      "        [\"" + HEX(8) + "\"] = \"" + HEX(16) + "\",",
      "        [\"" + HEX(8) + "\"] = {" + NUMS(5, 255) + "},",
      "        [" + R(9999) + "] = function() return \"" + HEX(6) + "\" end,",
      "    }",
      "    local " + b + " = 0",
      "    for " + c + ", " + d + " in pairs(" + a + ") do",
      "        if type(" + d + ") == \"number\" then " + b + " = " + b + " + " + d + " end",
      "    end",
      "end",
    ].join("\n");
  return [
    "do",
    "    local " + a + " = string.rep(\"" + HEX(4) + "\", " + (2 + R(6)) + ")",
    "    local " + b + " = {}",
    "    for " + c + " in string.gmatch(" + a + ", \"%x%x\") do",
    "        " + b + "[#" + b + " + 1] = tonumber(" + c + ", 16) or " + R(255),
    "    end",
    "    local " + d + " = #" + b + " * " + R(777) + " + " + R(777),
    "end",
  ].join("\n");
}

function junkCode() {
  const lines = [
    "--[[",
    "    [PROTEGIDO POR KRIPH]",
    "    Este script está protegido. El contenido que ves aquí NO es el código real.",
    "]]",
    "",
    "-- [PROTEGIDO POR KRIPH]",
    "local " + ID() + " = \"" + ESC("KRIPH") + "\"",
    "",
  ];
  const n = 45 + R(25);
  for (let i = 0; i < n; i++) {
    lines.push(junkBlock());
    lines.push("");
  }
  lines.push("-- [PROTEGIDO POR KRIPH]");
  return lines.join("\n");
}

const decoy = () =>
  new Response(junkCode(), {
    status: 200,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store, no-cache, must-revalidate, private",
      "x-robots-tag": "noindex, nofollow, noarchive",
      "x-content-type-options": "nosniff",
    },
  });

// Devuelve una Response si hay que bloquear, o null si la petición es legítima.
function guardRaw(req) {
  const kind = classify(req);
  if (kind === "preview") return blockPage(200);
  if (kind === "browser") return blockPage(403);
  if (kind === "tool") return decoy();
  if (limited(ipOf(req))) return decoy();
  if (!validSig(req)) return decoy();
  return null;
}

// Firma con la hora: el loadstring que copias desde tu página la calcula solo.
// Un link pegado "a pelo" (sin firma) o guardado de hace rato devuelve basura.
const SIG_WINDOW_S = 60;
const sigOf = (t) => (((t % 100000) * 48271 + 12345) % 2147483647) % 1000003;
function validSig(req) {
  const u = new URL(req.url);
  const t = Number(u.searchParams.get("t"));
  const s = Number(u.searchParams.get("s"));
  if (!Number.isInteger(t) || !Number.isInteger(s)) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - t) > SIG_WINDOW_S) return false;
  return s === sigOf(t);
}

const USER_RE = /^[a-z0-9_]{3,20}$/;
const MAX_BODY = 3 * 1024 * 1024;

const json = (o, s = 200) =>
  new Response(JSON.stringify(o), {
    status: s,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
const plain = (b, s = 200) =>
  new Response(b, {
    status: s,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });

const hashKey = (k) =>
  createHash("sha256").update((process.env.KRIPH_PEPPER || "kriph") + ":" + k).digest("hex");

function cleanName(n) {
  n = String(n || "").trim().replace(/\.lua$/i, "").toLowerCase();
  if (!n || n.length > 40 || /[\\\/:*?"<>|\x00-\x1f]/.test(n)) return null;
  return n;
}
const skey = (user, name) => user + "/" + encodeURIComponent(name);

// El primer usuario que publica con un nombre se queda con él; después hace falta la misma clave.
async function auth(users, user, key) {
  if (!USER_RE.test(user) || typeof key !== "string" || key.length < 32 || key.length > 128) return "bad";
  const hk = hashKey(key);
  const rec = await users.get(user, { type: "json" });
  if (!rec) {
    await users.setJSON(user, { h: hk, t: Date.now() });
    return "ok";
  }
  const a = Buffer.from(rec.h), b = Buffer.from(hk);
  return a.length === b.length && timingSafeEqual(a, b) ? "ok" : "owned";
}

export async function handle(req, { users, scripts }) {
  const url = new URL(req.url);
  const parts = url.pathname.split("/").filter(Boolean).map((p) => {
    try { return decodeURIComponent(p); } catch { return p; }
  });

  // ---- GET /raw/usuario/script[/main]
  if (parts[0] === "raw") {
    const blocked = guardRaw(req);
    if (blocked) return blocked;
    if (req.method !== "GET" && req.method !== "HEAD") return plain("-- KRIPH: método no permitido", 405);
    const user = (parts[1] || "").toLowerCase();
    const name = cleanName(parts[2]);
    if (!USER_RE.test(user) || !name || (parts[3] && parts[3] !== "main") || parts.length > 4)
      return plain("-- KRIPH: script no encontrado", 404);
    const code = await scripts.get(skey(user, name), { type: "text" });
    if (code == null) return plain("-- KRIPH: script no encontrado", 404);
    return plain(req.method === "HEAD" ? null : code);
  }

  // ---- /api/*
  if (parts[0] !== "api") return json({ error: "not found" }, 404);
  if (parts[1] === "ping") return json({ ok: true });
  if (req.method !== "POST" || (parts[1] !== "save" && parts[1] !== "delete"))
    return json({ error: "not found" }, 404);

  const raw = await req.text();
  if (raw.length > MAX_BODY) return json({ error: "Script demasiado grande" }, 413);
  let b;
  try { b = JSON.parse(raw); } catch { return json({ error: "JSON no válido" }, 400); }

  const user = String(b.user || "").toLowerCase();
  const name = cleanName(b.name);
  if (!name) return json({ error: "Nombre de script no válido" }, 400);

  const a = await auth(users, user, b.key);
  if (a === "bad") return json({ error: "Credenciales no válidas" }, 400);
  if (a === "owned") return json({ error: "Ese usuario ya está registrado con otra clave" }, 403);

  if (parts[1] === "delete") {
    await scripts.delete(skey(user, name));
    return json({ ok: true });
  }
  if (typeof b.code !== "string" || !b.code.trim()) return json({ error: "Script vacío" }, 400);
  await scripts.set(skey(user, name), b.code);
  return json({ ok: true, path: `/raw/${user}/${encodeURIComponent(name)}/main` });
}

export default async (req) => {
  const { getStore } = await import("@netlify/blobs");
  return handle(req, {
    users: getStore("kriph-users"),
    scripts: getStore("kriph-scripts"),
  });
};
