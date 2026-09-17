#!/usr/bin/env python3
"""Give Godot Web runtime files release-unique names.

GitHub Pages caches files for several minutes. Reusing index.js/index.wasm/index.pck
can combine files from different Godot exports in a returning browser, which makes
WebAssembly fail during startup. This post-process makes those three files an
atomic, cache-safe set identified by the commit SHA.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path


RUNTIME_EXTENSIONS = ("js", "wasm", "pck")


def version_export(export_dir: Path, release_id: str) -> str:
    safe_id = re.sub(r"[^a-zA-Z0-9_-]", "", release_id)[:16]
    if not safe_id:
        raise ValueError("release id must contain at least one safe character")

    html_path = export_dir / "index.html"
    html = html_path.read_text(encoding="utf-8")
    executable = f"index-{safe_id}"

    for extension in RUNTIME_EXTENSIONS:
        old_name = f"index.{extension}"
        new_name = f"{executable}.{extension}"
        source = export_dir / old_name
        if not source.is_file():
            raise FileNotFoundError(f"missing Godot runtime file: {source}")
        source.rename(export_dir / new_name)
        html = html.replace(old_name, new_name)

    html = html.replace('"executable":"index"', f'"executable":"{executable}"')
    if f'"executable":"{executable}"' not in html:
        raise RuntimeError("could not update GODOT_CONFIG executable")

    cache_meta = (
        '<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">\n'
        '\t\t<meta http-equiv="Pragma" content="no-cache">'
    )
    html = html.replace('<meta charset="utf-8">', f'<meta charset="utf-8">\n\t\t{cache_meta}')
    html_path.write_text(html, encoding="utf-8")

    manifest = {
        "release": release_id,
        "executable": executable,
        "runtime_files": [f"{executable}.{extension}" for extension in RUNTIME_EXTENSIONS],
    }
    (export_dir / "release.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    return executable


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("usage: version_web_export.py EXPORT_DIR RELEASE_ID")
    executable = version_export(Path(sys.argv[1]), sys.argv[2])
    print(f"Versioned Godot Web runtime as {executable}")


if __name__ == "__main__":
    main()
