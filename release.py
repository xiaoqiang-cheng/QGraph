"""
QGraph Release Script

Usage:
    python release.py                  Build wheel only (current version)
    python release.py --publish        Auto bump patch + build + upload to PyPI
    python release.py --bump patch     Bump patch version (0.1.1 -> 0.1.2)
    python release.py --bump minor     Bump minor version (0.1.1 -> 0.2.0)
    python release.py --bump major     Bump major version (0.1.1 -> 1.0.0)
    python release.py --bump 0.3.0     Set exact version
"""
import argparse
import platform
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).parent
PYPROJECT = ROOT / "pyproject.toml"
INIT_PY = ROOT / "src" / "qgraph" / "__init__.py"
WEB_DIR = ROOT / "web"
WEB_DIST = ROOT / "src" / "qgraph" / "web" / "dist"
DIST_DIR = ROOT / "dist"

USE_SHELL = platform.system() == "Windows"


def get_version() -> str:
    text = PYPROJECT.read_text(encoding="utf-8")
    m = re.search(r'version\s*=\s*"([^"]+)"', text)
    return m.group(1) if m else "unknown"


def get_init_version() -> str:
    text = INIT_PY.read_text(encoding="utf-8")
    m = re.search(r'__version__\s*=\s*"([^"]+)"', text)
    return m.group(1) if m else "unknown"


def bump_version(current: str, bump_type: str) -> str:
    parts = current.split(".")
    if len(parts) != 3 or not all(p.isdigit() for p in parts):
        print(f"  ERROR: Cannot auto-bump non-semver version: {current}")
        sys.exit(1)
    major, minor, patch = int(parts[0]), int(parts[1]), int(parts[2])
    if bump_type == "patch":
        return f"{major}.{minor}.{patch + 1}"
    elif bump_type == "minor":
        return f"{major}.{minor + 1}.0"
    elif bump_type == "major":
        return f"{major + 1}.0.0"
    else:
        return bump_type


def set_version(new_ver: str):
    old_ver = get_version()
    if old_ver == new_ver:
        print(f"  Version unchanged: {old_ver}")
        return
    for path in (PYPROJECT, INIT_PY):
        text = path.read_text(encoding="utf-8")
        text = text.replace(f'"{old_ver}"', f'"{new_ver}"')
        path.write_text(text, encoding="utf-8")
    print(f"  Version: {old_ver} -> {new_ver}")


def check_version_consistency():
    v_toml = get_version()
    v_init = get_init_version()
    if v_toml != v_init:
        print(f"  ERROR: Version mismatch! pyproject.toml={v_toml}, __init__.py={v_init}")
        sys.exit(1)


def run(cmd: list[str], cwd: Path | None = None):
    print(f"  $ {' '.join(cmd)}")
    result = subprocess.run(cmd, cwd=cwd, shell=USE_SHELL)
    if result.returncode != 0:
        print(f"  ERROR: Command failed with exit code {result.returncode}")
        sys.exit(1)


def check_code():
    print("\n[0/3] Pre-build checks...")
    errors = False

    print("  Running ruff check...")
    r = subprocess.run(
        [sys.executable, "-m", "ruff", "check", "src/"],
        cwd=ROOT, shell=USE_SHELL, capture_output=True, text=True,
    )
    if r.returncode != 0:
        print(f"  WARNING: ruff found issues:\n{r.stdout.strip()}")
        errors = True

    print("  Running tsc --noEmit...")
    r2 = subprocess.run(
        ["npx", "tsc", "--noEmit"],
        cwd=WEB_DIR, shell=USE_SHELL, capture_output=True, text=True,
    )
    if r2.returncode != 0:
        print(f"  ERROR: TypeScript errors:\n{r2.stdout.strip()}")
        sys.exit(1)

    if not errors:
        print("  All checks passed")


def build_frontend():
    print("\n[1/3] Building frontend...")
    if not (WEB_DIR / "node_modules").exists():
        run(["npm", "install"], cwd=WEB_DIR)
    run(["npm", "run", "build"], cwd=WEB_DIR)

    index_html = WEB_DIST / "index.html"
    if not index_html.exists():
        print(f"  ERROR: Frontend build failed - {index_html} not found")
        sys.exit(1)

    file_count = len(list(WEB_DIST.rglob("*")))
    total_size = sum(f.stat().st_size for f in WEB_DIST.rglob("*") if f.is_file())
    print(f"  Frontend built: {file_count} files, {total_size / 1024:.0f} KB")


def build_wheel():
    print("\n[2/3] Building wheel...")
    if DIST_DIR.exists():
        shutil.rmtree(DIST_DIR)
    run([sys.executable, "-m", "build", "--wheel", "--outdir", "dist"])


def publish():
    print("\n[3/3] Publishing to PyPI...")
    whl = list(DIST_DIR.glob("*.whl"))
    if not whl:
        print("  ERROR: No wheel found in dist/")
        sys.exit(1)
    run([sys.executable, "-m", "twine", "upload", str(whl[0])])


def main():
    parser = argparse.ArgumentParser(description="QGraph release tool")
    parser.add_argument("--publish", action="store_true", help="Upload to PyPI after build")
    parser.add_argument(
        "--bump", type=str, metavar="VERSION",
        help="Bump version: 'patch', 'minor', 'major', or exact version like '0.3.0'",
    )
    parser.add_argument("--skip-frontend", action="store_true", help="Skip frontend build")
    parser.add_argument("--skip-checks", action="store_true", help="Skip lint/type checks")
    args = parser.parse_args()

    print("QGraph Release")
    cur = get_version()
    print(f"  Current version: {cur}")

    check_version_consistency()

    if args.bump:
        new_ver = bump_version(cur, args.bump)
        set_version(new_ver)
    elif args.publish:
        new_ver = bump_version(cur, "patch")
        print(f"  Auto-bumping patch for publish: {cur} -> {new_ver}")
        set_version(new_ver)

    if not args.skip_checks:
        check_code()

    if not args.skip_frontend:
        build_frontend()
    else:
        print("\n[1/3] Skipping frontend build")

    build_wheel()

    ver = get_version()
    whl = list(DIST_DIR.glob("*.whl"))
    whl_size = whl[0].stat().st_size / 1024
    print(f"\n  Built: {whl[0].name} ({whl_size:.0f} KB)")

    if whl_size < 100:
        print("  WARNING: Wheel is very small (<100KB) - frontend may not be included!")

    if args.publish:
        publish()
        print(f"\n  Published qgraph v{ver} to PyPI!")
    else:
        print("\n  To publish: python release.py --publish")
        print(f"  To install locally: pip install {whl[0]}")


if __name__ == "__main__":
    main()
