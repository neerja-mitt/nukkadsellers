// Serves the Nukkad seller pages, stores applications and funnel events, and runs the
// private dashboard. Railway sets PORT. No dependencies.
//
// Storage: two append-only files on the Railway volume (mounted at /data):
//   applications.jsonl  one line per application
//   events.jsonl        one line per funnel step (no answers)
//
// Railway variables: DASH_PASSWORD (to open /dashboard). DATA_DIR is optional (default /data).
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.join(__dirname, "public");
const DASH_DIR = path.join(__dirname, "dashboard");
const PORT = process.env.PORT || 3000;
const TYPES = { ".html": "text/html; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".txt": "text/plain; charset=utf-8", ".xml": "application/xml; charset=utf-8", ".webp": "image/webp", ".js": "text/javascript; charset=utf-8" };

let DATA_DIR = process.env.DATA_DIR || "/data";
try { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.accessSync(DATA_DIR, fs.constants.W_OK); }
catch (e) { DATA_DIR = path.join(__dirname, "data"); fs.mkdirSync(DATA_DIR, { recursive: true }); console.warn("No volume at /data. Saving to " + DATA_DIR + ", which is lost on redeploy."); }
const APPS = path.join(DATA_DIR, "applications.jsonl");
const EVENTS = path.join(DATA_DIR, "events.jsonl");
const EVENT_COLS = ["submitted_at", "page", "ev", "step", "n", "cond", "sid", "src", "campaign", "content", "device", "ref"];

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on("data", (c) => { size += c.length; if (size > limit) { reject(new Error("too large")); req.destroy(); } else chunks.push(c); });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}
function fields(body, max) {
  const o = {};
  for (const [k, v] of new URLSearchParams(body)) { if (Object.keys(o).length < 60 && k.length <= 40) o[k] = String(v).slice(0, max); }
  return o;
}
function readLines(file) {
  try { return fs.readFileSync(file, "utf8").split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean); }
  catch (e) { return []; }
}
function send(res, code, type, body, extra) { res.writeHead(code, { "Content-Type": type, ...(extra || {}) }); res.end(body); }

async function api(req, res, p) {
  if (req.method !== "POST") return send(res, 405, "text/plain", "POST only");
  try {
    if (p === "/api/apply") {
      const f = fields(await readBody(req, 64 * 1024), 6000);
      if (!f.phone && !f.name) return send(res, 400, "application/json", '{"ok":false}');
      f.received_at = new Date().toISOString();
      fs.appendFileSync(APPS, JSON.stringify(f) + "\n");
      return send(res, 200, "application/json", '{"ok":true}');
    }
    if (p === "/api/e") {
      const f = fields(await readBody(req, 4 * 1024), 200);
      if (!f.ev || !f.sid) return send(res, 400, "text/plain", "bad");
      const row = {}; EVENT_COLS.forEach((k) => { row[k] = f[k] || ""; });
      row.received_at = new Date().toISOString();
      fs.appendFileSync(EVENTS, JSON.stringify(row) + "\n");
      return send(res, 204, "text/plain", "");
    }
  } catch (e) { return send(res, 400, "text/plain", "bad"); }
  send(res, 404, "text/plain", "Not found");
}

// ---------- private dashboard ----------
function same(a, b) { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); }
function authed(req) {
  const pass = process.env.DASH_PASSWORD;
  const m = /^Basic (.+)$/.exec(req.headers.authorization || "");
  if (!pass || !m) return false;
  const given = Buffer.from(m[1], "base64").toString();
  return same(given.slice(given.indexOf(":") + 1), pass);
}
const APP_ORDER = ["received_at", "track", "name", "brand", "city", "phone", "link", "category", "sells", "other", "kind", "craft", "story", "docs", "where", "markets", "pieces", "live", "livesales", "livewhy", "pain", "price", "help", "frequency", "utm"];
function csv(rows) {
  const cols = APP_ORDER.slice();
  rows.forEach((r) => Object.keys(r).forEach((k) => { if (!cols.includes(k)) cols.push(k); }));
  const esc = (v) => { v = v == null ? "" : String(v); return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  return "﻿" + [cols.join(",")].concat(rows.map((r) => cols.map((c) => esc(r[c])).join(","))).join("\r\n");
}
function dashboard(req, res, p) {
  if (!process.env.DASH_PASSWORD) return send(res, 503, "text/plain", "Dashboard not set up yet: add DASH_PASSWORD in Railway.");
  if (!authed(req)) return send(res, 401, "text/plain", "Password needed.", { "WWW-Authenticate": 'Basic realm="Nukkad dashboard", charset="UTF-8"' });
  const priv = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };
  if (p === "/dashboard/data") {
    const rows = readLines(EVENTS).map((r) => EVENT_COLS.map((k) => r[k] || ""));
    return send(res, 200, "application/json; charset=utf-8", JSON.stringify({ values: [EVENT_COLS].concat(rows) }), priv);
  }
  if (p === "/dashboard/applications") return send(res, 200, "application/json; charset=utf-8", JSON.stringify(readLines(APPS).reverse()), priv);
  if (p === "/dashboard/applications.csv") {
    const day = new Date(Date.now() + 19800000).toISOString().slice(0, 10);
    return send(res, 200, "text/csv; charset=utf-8", csv(readLines(APPS)), { ...priv, "Content-Disposition": 'attachment; filename="nukkad-applications-' + day + '.csv"' });
  }
  const file = p === "/dashboard/d3.min.js" ? "d3.min.js" : "index.html";
  fs.readFile(path.join(DASH_DIR, file), (err, data) => {
    if (err) return send(res, 404, "text/plain", "Not found");
    send(res, 200, TYPES[path.extname(file)], data, priv);
  });
}

// ---------- static pages ----------
http.createServer((req, res) => {
  let p;
  try { p = decodeURIComponent(req.url.split("?")[0]); } catch (e) { return send(res, 400, "text/plain", "Bad request"); }
  if (p === "/health") return send(res, 200, "text/plain", "ok");
  if (p.startsWith("/api/")) return api(req, res, p);
  if (p === "/dashboard" || p.startsWith("/dashboard/")) return dashboard(req, res, p);
  if (p.endsWith("/")) p += "index.html";
  let file = path.normalize(path.join(ROOT, p));
  if (!file.startsWith(ROOT)) return send(res, 403, "text/plain", "");
  if (!path.extname(file)) file = path.join(file, "index.html");   // /thrift -> /thrift/index.html
  fs.readFile(file, (err, data) => {
    if (err) {
      fs.readFile(path.join(ROOT, "index.html"), (e2, home) => send(res, 404, TYPES[".html"], e2 ? "Not found" : home));
      return;
    }
    const cache = p.startsWith("/img/") ? "public, max-age=31536000, immutable" : path.extname(file) === ".html" ? "no-cache" : "public, max-age=300";
    send(res, 200, TYPES[path.extname(file)] || "application/octet-stream", data, { "Cache-Control": cache });
  });
}).listen(PORT, () => console.log("Nukkad pages on port " + PORT + ", data in " + DATA_DIR));
