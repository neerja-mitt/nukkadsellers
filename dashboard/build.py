"""Build dashboard/index.html from shell.html + body.html (the same page code as the Claude dashboard)."""
import pathlib
d = pathlib.Path(__file__).parent
out = (d / "shell.html").read_text().replace("{{BODY}}", (d / "body.html").read_text())
(d / "index.html").write_text(out); print(len(out), "bytes")
