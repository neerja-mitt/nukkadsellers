# Nukkad pages

- public/index.html: makers and brands page (www.shopnukkad.live)
- public/thrift/index.html: thrift page (www.shopnukkad.live/thrift)
- server.js: a small Node server with no dependencies. Railway runs `npm start`.

To update a page, replace the HTML file in public/ and redeploy.

## Updating the pages

Build the pages (build_v2.py, build_thrift.py), then run `python3 publish.py`. It copies them into public/, moves photos into public/img/ and adds structured data from each page's FAQ.

## Applications, funnel and dashboard

The server saves everything itself, on the Railway volume mounted at /data:
- applications.jsonl: one line per application (from POST /api/apply)
- events.jsonl: one line per funnel step, no answers (from POST /api/e)

shopnukkad.live/dashboard shows the funnel and the applications, with a CSV download. Deleting an application from the dashboard hides it (its id goes into deleted.jsonl); the original line stays in applications.jsonl. Visits tagged src=claudetest or selftest are left out of the funnel. It needs the Railway variable DASH_PASSWORD. To change it, edit dashboard/body.html, apps.html or shell.html and run `python3 dashboard/build.py`.
