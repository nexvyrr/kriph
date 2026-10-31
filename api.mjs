// KRIPH · API + servidor "raw" en una sola función de Netlify.
//   POST /api/save    {user,key,name,code}  -> publica/actualiza un script
//   POST /api/delete  {user,key,name}       -> borra un script
//   GET  /raw/<usuario>/<script>/main       -> devuelve el código en texto plano (para HttpGet)
import { createHash, timingSafeEqual } from "node:crypto";

export const config = { path: ["/api/*", "/raw/*"] };

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
