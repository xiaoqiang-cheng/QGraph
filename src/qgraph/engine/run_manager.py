from __future__ import annotations

import asyncio
import json
import logging
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

from qgraph.core.storage import get_logs_dir
from qgraph.engine.executor import PipelineExecutor

logger = logging.getLogger("qgraph.run_manager")


@dataclass
class RunInfo:
    run_id: str
    graph_name: str
    status: str = "running"
    started_at: float = field(default_factory=time.time)
    finished_at: float | None = None
    current_node: str | None = None
    node_statuses: dict[str, str] = field(default_factory=dict)
    logs: list[str] = field(default_factory=list)
    executor: PipelineExecutor | None = None
    task: asyncio.Task | None = None


class RunManager:
    def __init__(self):
        self._runs: dict[str, RunInfo] = {}
        self._counter = 0
        self._on_log: Any = None
        self._on_status: Any = None

    def set_callbacks(self, on_log: Any, on_status: Any):
        self._on_log = on_log
        self._on_status = on_status

    def list_runs(self, include_finished: bool = True) -> list[dict[str, Any]]:
        results = []
        for run in self._runs.values():
            if not include_finished and run.status != "running":
                continue
            elapsed = (run.finished_at or time.time()) - run.started_at
            results.append({
                "run_id": run.run_id,
                "graph_name": run.graph_name,
                "status": run.status,
                "started_at": run.started_at,
                "elapsed_seconds": round(elapsed, 1),
                "current_node": run.current_node,
                "node_statuses": dict(run.node_statuses),
            })
        return results

    def get_run(self, run_id: str) -> RunInfo | None:
        return self._runs.get(run_id)

    def get_runs_for_graph(self, graph_name: str) -> list[RunInfo]:
        return [r for r in self._runs.values() if r.graph_name == graph_name]

    def _save_log(self, run_info: RunInfo):
        try:
            logs_dir = get_logs_dir()
            log_data = {
                "run_id": run_info.run_id,
                "graph_name": run_info.graph_name,
                "status": run_info.status,
                "started_at": datetime.fromtimestamp(run_info.started_at, tz=timezone.utc).isoformat(),
                "finished_at": datetime.fromtimestamp(run_info.finished_at, tz=timezone.utc).isoformat()
                if run_info.finished_at
                else None,
                "node_statuses": dict(run_info.node_statuses),
                "logs": run_info.logs,
            }
            log_path = logs_dir / f"{run_info.run_id}.json"
            log_path.write_text(json.dumps(log_data, indent=2, ensure_ascii=False), encoding="utf-8")
            print(f"[QGraph] Saved log: {log_path}", flush=True)
        except Exception as e:
            print(f"[QGraph] Failed to save log for {run_info.run_id}: {e}", flush=True)
            import traceback
            traceback.print_exc()

    @staticmethod
    def load_log(run_id: str) -> dict[str, Any] | None:
        log_path = get_logs_dir() / f"{run_id}.json"
        if not log_path.exists():
            return None
        return json.loads(log_path.read_text(encoding="utf-8"))

    @staticmethod
    def list_saved_logs() -> list[dict[str, Any]]:
        results = []
        for path in sorted(get_logs_dir().glob("*.json"), reverse=True):
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
                results.append({
                    "run_id": data.get("run_id", path.stem),
                    "graph_name": data.get("graph_name", ""),
                    "status": data.get("status", ""),
                    "started_at": data.get("started_at", ""),
                    "finished_at": data.get("finished_at"),
                    "log_count": len(data.get("logs", [])),
                })
            except (json.JSONDecodeError, OSError):
                continue
        return results

    @staticmethod
    def delete_log(run_id: str) -> bool:
        log_path = get_logs_dir() / f"{run_id}.json"
        if not log_path.exists():
            return False
        try:
            log_path.unlink()
        except OSError:
            pass
        return not log_path.exists()

    async def start_run(
        self,
        graph_name: str,
        graph_data: dict[str, Any],
        skip_nodes: set[str] | None = None,
    ) -> str:
        self._counter += 1
        run_id = f"run_{graph_name}_{self._counter}_{int(time.time())}"

        run_info = RunInfo(
            run_id=run_id,
            graph_name=graph_name,
        )
        self._runs[run_id] = run_info

        async def on_log(gn: str, node_id: str, message: str):
            run_info.logs.append(f"[{node_id}] {message}")
            if self._on_log:
                await self._on_log(gn, node_id, message, run_id)

        async def on_status(gn: str, node_id: str, status: str):
            run = self._runs.get(run_id)
            if run:
                run.node_statuses[node_id] = status
                if status == "running":
                    run.current_node = node_id
            if self._on_status:
                await self._on_status(gn, node_id, status, run_id)

        executor = PipelineExecutor(on_log=on_log, on_status=on_status)
        run_info.executor = executor

        async def _run():
            try:
                results = await executor.execute(graph_data, skip_nodes=skip_nodes)
                from qgraph.core.models import NodeStatus
                has_failed = any(
                    r.status == NodeStatus.FAILED for r in results.values()
                )
                run_info.status = "failed" if has_failed else "completed"
            except Exception as e:
                run_info.status = f"error: {e}"
            finally:
                run_info.finished_at = time.time()
                run_info.current_node = None
                self._save_log(run_info)

        run_info.task = asyncio.create_task(_run())
        return run_id

    async def stop_run(self, run_id: str) -> bool:
        run = self._runs.get(run_id)
        if not run or run.status != "running":
            return False
        if run.executor:
            run.executor.cancel()
        if run.task:
            run.task.cancel()
        run.status = "stopped"
        run.finished_at = time.time()
        run.current_node = None
        self._save_log(run)
        return True

    def cleanup_finished(self, max_age_seconds: float = 3600):
        now = time.time()
        to_remove = []
        for run_id, run in self._runs.items():
            if run.finished_at and (now - run.finished_at) > max_age_seconds:
                to_remove.append(run_id)
        for run_id in to_remove:
            del self._runs[run_id]


run_manager = RunManager()
