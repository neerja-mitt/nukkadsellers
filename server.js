// Serves the Nukkad seller pages. Railway sets PORT.
const http = require("http");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "public");
const PORT = process.env.PORT || 3000;

// Private dashboard at /dashboard. Set DASH_PASSWORD and DASH_KEY in Railway's Variables.
const DASH_DIR = path.join(__dirname, "dashboard");
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzpjgFfIlyYfiOgR86i-rqNqp24_saCZnL-mKxINhipMGxNUdQU9dcuqB6POYRIrqON/exec";
let cache = { at: 0, body: null };
function same(a, b) { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); }
function authed(req) {
  const pass = process.env.DASH_PASSWORD;
  if (!pass) return false;
  const m = /^Basic (.+)$/.exec(req.headers.authorization || "");
  if (!m) return false;
  const given = Buffer.from(m[1], "base64").toString();
  return same(given.slice(given.indexOf(":") + 1), pass);
}
async function dashboard(req, res, p) {
  if (!process.env.DASH_PASSWORD || !process.env.DASH_KEY) { res.writeHead(503, { "Content-Type": "text/plain" }); return res.end("Dashboard not set up yet: add DASH_PASSWORD and DASH_KEY in Railway."); }
  if (p === "/dashboard/selftest") {
    // Sends one test event to the Apps Script and shows its reply. Needs ?key=DASH_KEY.
    const key = new URL(req.url, "http://x").searchParams.get("key") || "";
    if (!same(key, process.env.DASH_KEY)) { res.writeHead(403); return res.end("Wrong key."); }
    try {
      const U = process.env.DASH_FEED_URL || SCRIPT_URL;
      const fields = { track: "events", ev: "selftest", page: "maker", sid: "selftest", src: "selftest", submitted_at: new Date().toISOString() };
      const plain = (t) => t.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 300);
      const tries = [
        ["POST form body", () => fetch(U, { method: "POST", body: new URLSearchParams({ ...fields, variant: "a" }) })],
        ["POST query only", () => fetch(U + "?" + new URLSearchParams({ ...fields, variant: "b" }), { method: "POST" })],
        ["POST text body", () => fetch(U + "?" + new URLSearchParams({ ...fields, variant: "c" }), { method: "POST", headers: { "Content-Type": "text/plain" }, body: "x" })],
        ["POST no redirect", () => fetch(U, { method: "POST", body: new URLSearchParams({ ...fields, variant: "d" }), redirect: "manual" })],
        ["GET", () => fetch(U + "?key=nope")],
      ];
      let out = "";
      for (const [name, go] of tries) {
        try { const r = await go(); const t = await r.text(); out += name + ": " + r.status + " " + (r.headers.get("location") || r.url) + "\n  " + plain(t) + "\n\n"; }
        catch (e) { out += name + ": failed " + e.message + "\n\n"; }
      }
      res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });
      return res.end(out);
    } catch (e) { res.writeHead(502); return res.end("Request failed: " + e.message); }
  }
  if (!authed(req)) { res.writeHead(401, { "WWW-Authenticate": 'Basic realm="Nukkad dashboard", charset="UTF-8"', "Content-Type": "text/plain" }); return res.end("Password needed."); }
  const priv = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };
  if (p === "/dashboard/data") {
    try {
      if (!cache.body || Date.now() - cache.at > 60000) {
        const r = await fetch((process.env.DASH_FEED_URL || SCRIPT_URL) + "?key=" + encodeURIComponent(process.env.DASH_KEY), { redirect: "follow" });
        const text = await r.text();
        const json = JSON.parse(text);
        if (json.error) throw new Error(json.error);
        cache = { at: Date.now(), body: text };
      }
      res.writeHead(200, { ...priv, "Content-Type": "application/json; charset=utf-8" });
      return res.end(cache.body);
    } catch (e) {
      res.writeHead(502, { ...priv, "Content-Type": "text/plain" });
      return res.end("Couldn't read the sheet: " + e.message);
    }
  }
  const file = p === "/dashboard/d3.min.js" ? "d3.min.js" : "index.html";
  fs.readFile(path.join(DASH_DIR, file), (err, data) => {
    if (err) { res.writeHead(404); return res.end("Not found"); }
    res.writeHead(200, { ...priv, "Content-Type": file.endsWith(".js") ? "text/javascript; charset=utf-8" : TYPES[".html"] });
    res.end(data);
  });
}
const TYPES = { ".html": "text/html; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".txt": "text/plain; charset=utf-8", ".xml": "application/xml; charset=utf-8", ".webp": "image/webp" };

http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p === "/health") { res.writeHead(200); return res.end("ok"); }
  if (p === "/dashboard" || p.startsWith("/dashboard/")) return dashboard(req, res, p);
  if (p.endsWith("/")) p += "index.html";
  let file = path.normalize(path.join(ROOT, p));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  if (!path.extname(file)) file = path.join(file, "index.html");   // /thrift -> /thrift/index.html
  fs.readFile(file, (err, data) => {
    if (err) {
      fs.readFile(path.join(ROOT, "index.html"), (e2, home) => {
        res.writeHead(e2 ? 404 : 404, { "Content-Type": TYPES[".html"] });
        res.end(e2 ? "Not found" : home);
      });
      return;
    }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream", "Cache-Control": p.startsWith("/img/") ? "public, max-age=31536000, immutable" : path.extname(file) === ".html" ? "no-cache" : "public, max-age=300" });
    res.end(data);
  });
}).listen(PORT, () => console.log("Nukkad pages on port " + PORT));
