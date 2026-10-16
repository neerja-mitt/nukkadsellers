"""Build dashboard/index.html from shell.html + body.html (the same page code as the Claude dashboard),
with the Applications section (apps.html) placed right under the filters."""
import pathlib
d = pathlib.Path(__file__).parent
body = (d / "body.html").read_text()
anchor = '  <section class="nf-tiles" id="headline">'
assert body.count(anchor) == 1
body = body.replace(anchor, (d / "apps.html").read_text() + "\n" + anchor)
out = (d / "shell.html").read_text().replace("{{BODY}}", body)
(d / "index.html").write_text(out); print(len(out), "bytes")
