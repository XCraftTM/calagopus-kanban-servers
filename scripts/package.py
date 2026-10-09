#!/usr/bin/env python3
"""Builds dist/<identifier>.c7s.zip in the layout `panel-rs extensions export` produces."""

import tomllib
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SKIP_DIRS = {"node_modules", "target", ".git"}
SKIP_FILES = {"tsconfig.json"}


def entries_under(base: Path):
    for path in sorted(base.rglob("*")):
        rel = path.relative_to(ROOT)
        if SKIP_DIRS.intersection(rel.parts) or path.name in SKIP_FILES:
            continue
        yield path


def add(zf: zipfile.ZipFile, path: Path, name: str):
    if path.is_dir():
        # the panel's validator requires explicit directory entries
        zf.writestr(zipfile.ZipInfo(name.rstrip("/") + "/"), b"")
    else:
        zf.write(path, name)


def main():
    meta = tomllib.loads((ROOT / "Metadata.toml").read_text())
    identifier = meta["package_name"].replace(".", "_")
    out = ROOT / "dist" / f"{identifier}.c7s.zip"
    out.parent.mkdir(exist_ok=True)

    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
        fe = ROOT / "frontend"
        add(zf, ROOT / "Metadata.toml", "Metadata.toml")
        add(zf, ROOT, "backend/")
        add(zf, ROOT / "Cargo.toml", "backend/Cargo.toml")
        add(zf, ROOT / "src", "backend/src/")
        for p in entries_under(ROOT / "src"):
            add(zf, p, f"backend/{p.relative_to(ROOT).as_posix()}")
        add(zf, fe, "frontend/")
        add(zf, fe / "package.json", "frontend/package.json")
        for sub in ("src", "public"):
            if (fe / sub).is_dir():
                add(zf, fe / sub, f"frontend/{sub}/")
                for p in entries_under(fe / sub):
                    add(zf, p, f"frontend/{p.relative_to(fe).as_posix()}")

    print(f"wrote {out.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
