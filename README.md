# Nukkad pages

- public/index.html: makers and brands page (www.shopnukkad.live)
- public/thrift/index.html: thrift page (www.shopnukkad.live/thrift)
- server.js: a small Node server with no dependencies. Railway runs `npm start`.

To update a page, replace the HTML file in public/ and redeploy.

## Updating the pages

Build the pages (build_v2.py, build_thrift.py), then run `python3 publish.py`. It copies them into public/, moves photos into public/img/ and adds structured data from each page's FAQ.
