"""
QGraph Smoke Tests

Run:  python -m pytest tests/test_smoke.py -v
Or:   python tests/test_smoke.py
"""
import asyncio
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).parent.parent
SRC = ROOT / "src"

os.environ["PYTHONPATH"] = str(SRC) + os.pathsep + os.environ.get("PYTHONPATH", "")

PASSED = 0
FAILED = 0
ERRORS: list[str] = []


def check(name: str, condition: bool, detail: str = ""):
    global PASSED, FAILED
    if condition:
        PASSED += 1
        print(f"  \033[32m✓\033[0m {name}")
    else:
        FAILED += 1
        msg = f"{name}: {detail}" if detail else name
        ERRORS.append(msg)
        print(f"  \033[31m✗\033[0m {name}" + (f" — {detail}" if detail else ""))


def run_cmd(args: list[str], cwd: str | None = None, timeout: int = 30) -> tuple[int, str]:
    env = {**os.environ, "PYTHONIOENCODING": "utf-8"}
    result = subprocess.run(
        args, capture_output=True, cwd=cwd,
        timeout=timeout, shell=(sys.platform == "win32"), env=env,
    )
    stdout = result.stdout.decode("utf-8", errors="replace") if result.stdout else ""
    stderr = result.stderr.decode("utf-8", errors="replace") if result.stderr else ""
    return result.returncode, stdout + stderr


def test_cli_basics():
    print("\n[1] CLI Basics")

    rc, out = run_cmd(["qgraph", "--version"])
    check("qgraph --version", rc == 0 and "qgraph" in out.lower(), out.strip())

    rc, out = run_cmd(["qgraph", "--help"])
    check("qgraph --help", rc == 0 and "serve" in out and "run" in out)

    rc, out = run_cmd(["qgraph", "list"])
    check("qgraph list", rc == 0)


def test_init():
    print("\n[2] qgraph init")
    tmp = tempfile.mkdtemp(prefix="qgraph_test_")
    try:
        rc, out = run_cmd(["qgraph", "init"], cwd=tmp)
        check("qgraph init", rc == 0 and "Initialized" in out, out.strip())
        check(".qgraph/graphs/ created", (Path(tmp) / ".qgraph" / "graphs").is_dir())
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def test_create_delete():
    print("\n[3] Create / Delete Graph")
    name = "__smoke_test_graph__"

    rc, out = run_cmd(["qgraph", "create", name])
    check(f"create {name}", rc == 0 and "Created" in out, out.strip())

    rc, out = run_cmd(["qgraph", "list"])
    check(f"list shows {name}", rc == 0 and name in out)

    rc, out = run_cmd(["qgraph", "delete", name])
    check(f"delete {name}", rc == 0 and "Deleted" in out, out.strip())

    rc, out = run_cmd(["qgraph", "list"])
    check(f"list no longer shows {name}", rc == 0 and name not in out)


def test_export_import():
    print("\n[4] Export / Import")
    name = "__smoke_test_export__"
    tmp = tempfile.mkdtemp(prefix="qgraph_test_")
    export_path = os.path.join(tmp, f"{name}.json")
    try:
        run_cmd(["qgraph", "create", name])
        rc, out = run_cmd(["qgraph", "export", name, "-o", export_path])
        check("export", rc == 0 and Path(export_path).exists(), out.strip())

        run_cmd(["qgraph", "delete", name])
        rc, out = run_cmd(["qgraph", "import", export_path])
        check("import", rc == 0 and "Imported" in out, out.strip())

        run_cmd(["qgraph", "delete", name])
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def test_run_pipeline():
    print("\n[5] Run Pipeline (ml-training-pipeline)")
    rc, out = run_cmd(["qgraph", "run", "ml-training-pipeline"], cwd=str(ROOT), timeout=60)
    check("run completes", rc == 0, f"exit={rc}")
    check("all nodes success", "completed successfully" in out, out[-200:])
    check("no failures", "failed" not in out.lower() or "0 failed" in out.lower())


def test_run_with_failure():
    print("\n[6] Run Pipeline (test-with-failure)")
    rc, out = run_cmd(["qgraph", "run", "test-with-failure"], cwd=str(ROOT), timeout=60)
    check("run exits non-zero", rc != 0)
    check("has failed nodes", "failed" in out.lower())
    check("has skipped nodes", "skipped" in out.lower())


def test_ps():
    print("\n[7] qgraph ps")
    rc, out = run_cmd(["qgraph", "ps"])
    check("ps works (no running)", rc == 0)
    check("ps says no running", "No running" in out or "Running" in out, out[:100])

    rc2, out2 = run_cmd(["qgraph", "ps", "-a"])
    check("ps -a shows history", rc2 == 0 and "Executions" in out2, out2[:100])


def test_logs():
    print("\n[8] qgraph logs")
    from qgraph.engine.run_manager import RunManager
    saved = RunManager.list_saved_logs()
    if saved:
        run_id = saved[0]["run_id"]
        rc, out = run_cmd(["qgraph", "logs", run_id])
        check(f"logs {run_id[:30]}", rc == 0, out[:100])
    else:
        check("logs (no saved logs to test)", True)


def test_executor():
    print("\n[9] Executor Unit Test")

    from qgraph.core.storage import GraphStorage
    from qgraph.engine.executor import PipelineExecutor

    storage = GraphStorage()
    data = storage.load_graph("input-params-demo")
    if not data:
        check("input-params-demo exists", False, "graph not found")
        return

    logs: list[str] = []

    async def on_log(_g: str, _n: str, msg: str):
        logs.append(msg)

    async def on_status(_g: str, _n: str, _s: str):
        pass

    executor = PipelineExecutor(on_log=on_log, on_status=on_status)
    results = asyncio.run(executor.execute(data))

    all_success = all(r.status.value == "success" for r in results.values())
    check("all nodes success", all_success, str({k: v.status.value for k, v in results.items()}))
    check("logs captured", len(logs) > 0, f"log count: {len(logs)}")
    check("input params inherited", any("Inherited" in l for l in logs))


def test_storage_local_vs_global():
    print("\n[10] Storage Local vs Global")
    tmp = tempfile.mkdtemp(prefix="qgraph_test_")
    try:
        orig_cwd = os.getcwd()
        os.chdir(tmp)
        try:
            from qgraph.core.storage import GraphStorage
            GraphStorage.init_local()
            local_dir = Path(tmp) / ".qgraph" / "graphs"
            check("init creates .qgraph/graphs/", local_dir.is_dir())

            s = GraphStorage()
            s.create_graph("local_test")
            check("local graph created", (local_dir / "local_test.json").exists())

            data = s.load_graph("local_test")
            check("local graph has project_dir", "project_dir" in (data or {}))

            s.delete_graph("local_test")
            check("local graph deleted", not (local_dir / "local_test.json").exists())
        finally:
            os.chdir(orig_cwd)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def test_ruff():
    print("\n[11] Code Quality")
    rc, out = run_cmd([sys.executable, "-m", "ruff", "check", "src/"], cwd=str(ROOT))
    check("ruff check src/", rc == 0, out.strip())


def test_typescript():
    print("\n[12] TypeScript Check")
    web_dir = ROOT / "web"
    if not (web_dir / "node_modules").exists():
        check("node_modules exists", False, "run 'npm install' first")
        return
    rc, out = run_cmd(["npx", "tsc", "--noEmit"], cwd=str(web_dir), timeout=60)
    check("tsc --noEmit", rc == 0, out.strip()[:200])


def main():
    print("=" * 60)
    print("QGraph Smoke Tests")
    print("=" * 60)

    test_cli_basics()
    test_init()
    test_create_delete()
    test_export_import()
    test_run_pipeline()
    test_run_with_failure()
    test_ps()
    test_logs()
    test_executor()
    test_storage_local_vs_global()
    test_ruff()
    test_typescript()

    print("\n" + "=" * 60)
    total = PASSED + FAILED
    if FAILED == 0:
        print(f"\033[32m  ALL {total} CHECKS PASSED\033[0m")
    else:
        print(f"\033[31m  {FAILED}/{total} CHECKS FAILED:\033[0m")
        for err in ERRORS:
            print(f"    \033[31m✗ {err}\033[0m")
    print("=" * 60)

    return 1 if FAILED > 0 else 0


if __name__ == "__main__":
    sys.exit(main())
