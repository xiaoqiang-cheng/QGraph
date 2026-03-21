"""
QGraph Release Script

Usage:
    python release.py              Build wheel only
    python release.py --publish    Build + upload to PyPI (requires twine)
    python release.py --bump       Show current version and prompt for new one
"""
import argparse
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).parent
PYPROJECT = ROOT / "pyproject.toml"
INIT_PY = ROOT / "src" / "qgraph" / "__init__.py"
WEB_DIR = ROOT / "web"
DIST_DIR = ROOT / "dist"


def get_version() -> str:
    text = PYPROJECT.read_text(encoding="utf-8")
    m = re.search(r'version\s*=\s*"([^"]+)"', text)
    return m.group(1) if m else "unknown"


def set_version(new_ver: str):
    old_ver = get_version()
    for path in (PYPROJECT, INIT_PY):
        text = path.read_text(encoding="utf-8")
        text = text.replace(f'"{old_ver}"', f'"{new_ver}"')
        path.write_text(text, encoding="utf-8")
    print(f"  Version: {old_ver} -> {new_ver}")


def run(cmd: list[str], cwd: Path | None = None):
    print(f"  $ {' '.join(cmd)}")
    result = subprocess.run(cmd, cwd=cwd, shell=True)
    if result.returncode != 0:
        print(f"  ERROR: Command failed with exit code {result.returncode}")
        sys.exit(1)


def build_frontend():
    print("\n[1/3] Building frontend...")
    if not (WEB_DIR / "node_modules").exists():
        run(["npm", "install"], cwd=WEB_DIR)
    run(["npm", "run", "build"], cwd=WEB_DIR)


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
    parser.add_argument("--bump", type=str, metavar="VERSION", help="Set new version before build")
    parser.add_argument("--skip-frontend", action="store_true", help="Skip frontend build")
    args = parser.parse_args()

    print(f"QGraph Release")
    print(f"  Current version: {get_version()}")

    if args.bump:
        set_version(args.bump)

    if not args.skip_frontend:
        build_frontend()
    else:
        print("\n[1/3] Skipping frontend build")

    build_wheel()

    ver = get_version()
    whl = list(DIST_DIR.glob("*.whl"))
    print(f"\n  Built: {whl[0].name} ({whl[0].stat().st_size / 1024:.0f} KB)")

    if args.publish:
        publish()
        print(f"\n  Published qgraph v{ver} to PyPI!")
    else:
        print(f"\n  To publish: python release.py --publish")
        print(f"  To install locally: pip install {whl[0]}")


if __name__ == "__main__":
    main()
