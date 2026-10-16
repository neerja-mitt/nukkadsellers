"""Copy the built pages into public/, move embedded photos into public/img/ (faster pages, better for search),
and add structured data (Organization, WebSite, WebPage, FAQPage) built from each page's own FAQ."""
import base64, hashlib, html, json, pathlib, re, sys
HERE = pathlib.Path(__file__).parent; PUB = HERE / "public"; IMG = PUB / "img"; IMG.mkdir(parents=True, exist_ok=True)
SITE = "https://www.shopnukkad.live"
PAGES = [("/home/claude/nukkad-sellers-v2.html", PUB / "index.html", SITE + "/", "Nukkad for homegrown brands"),
         ("/home/claude/nukkad-thrift.html", PUB / "thrift" / "index.html", SITE + "/thrift", "Nukkad for thrift and vintage stores")]
def strip(s): return html.unescape(re.sub(r"<[^>]+>", "", s)).strip()
used = set()
for src, dst, url, name in PAGES:
    s = pathlib.Path(src).read_text(encoding="utf-8")
    def out(m):
        data = base64.b64decode(m.group(1)); h = hashlib.sha1(data).hexdigest()[:12]
        (IMG / f"{h}.jpg").write_bytes(data); used.add(f"{h}.jpg"); return f"/img/{h}.jpg"
    s = re.sub(r"data:image/jpeg;base64,([A-Za-z0-9+/=]+)", out, s)
    title = re.search(r"<title>(.*?)</title>", s).group(1)
    desc = re.search(r'<meta name="description" content="([^"]*)"', s).group(1)
    faqs = [(strip(q), strip(a)) for q, a in re.findall(r"<details><summary>(.*?)</summary><p>(.*?)</p></details>", s, re.S)]
    graph = [
        {"@type": "Organization", "@id": SITE + "/#org", "name": "Nukkad", "url": SITE + "/", "logo": SITE + "/icon-512.png",
         "description": "Live shopping from India's homegrown brands and thrift stores.", "areaServed": "IN",
         "sameAs": ["https://www.instagram.com/shopnukkad.live/"]},
        {"@type": "WebSite", "@id": SITE + "/#site", "url": SITE + "/", "name": "Nukkad", "inLanguage": "en-IN", "publisher": {"@id": SITE + "/#org"}},
        {"@type": "WebPage", "@id": url + "#page", "url": url, "name": title, "description": desc, "inLanguage": "en-IN",
         "isPartOf": {"@id": SITE + "/#site"}, "about": {"@id": SITE + "/#org"}, "primaryImageOfPage": SITE + ("/og-thrift.png" if "thrift" in url else "/og.png")},
        {"@type": "FAQPage", "@id": url + "#faq", "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in faqs]},
    ]
    ld = '<script type="application/ld+json">' + json.dumps({"@context": "https://schema.org", "@graph": graph}, ensure_ascii=False).replace("</", "<\\/") + "</script>\n"
    s = s.replace("</title>\n", "</title>\n" + ld, 1)
    assert "data:image/jpeg" not in s and "application/ld+json" in s
    dst.parent.mkdir(parents=True, exist_ok=True); dst.write_text(s, encoding="utf-8")
    print(dst.relative_to(HERE), len(s) // 1024, "KB,", len(faqs), "FAQs")
for f in IMG.glob("*.jpg"):
    if f.name not in used: f.unlink()
print(len(used), "images")
