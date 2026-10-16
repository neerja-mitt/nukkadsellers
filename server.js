// Serves the Nukkad seller pages. Railway sets PORT.
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "public");
const PORT = process.env.PORT || 3000;
const TYPES = { ".html": "text/html; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".txt": "text/plain; charset=utf-8", ".xml": "application/xml; charset=utf-8", ".webp": "image/webp" };

http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p === "/health") { res.writeHead(200); return res.end("ok"); }
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
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream", "Cache-Control": p.startsWith("/img/") ? "public, max-age=31536000, immutable" : "public, max-age=300" });
    res.end(data);
  });
}).listen(PORT, () => console.log("Nukkad pages on port " + PORT));
