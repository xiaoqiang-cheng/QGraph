from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def get_qgraph_home() -> Path:
    home = Path.home() / ".qgraph"
    home.mkdir(parents=True, exist_ok=True)
    return home


def get_local_qgraph_dir() -> Path | None:
    local = Path.cwd() / ".qgraph"
    if local.is_dir():
        return local
    return None


def get_graphs_dir() -> Path:
    local = get_local_qgraph_dir()
    if local:
        graphs_dir = local / "graphs"
        graphs_dir.mkdir(parents=True, exist_ok=True)
        return graphs_dir
    graphs_dir = get_qgraph_home() / "graphs"
    graphs_dir.mkdir(parents=True, exist_ok=True)
    return graphs_dir


def get_global_graphs_dir() -> Path:
    graphs_dir = get_qgraph_home() / "graphs"
    graphs_dir.mkdir(parents=True, exist_ok=True)
    return graphs_dir


def get_logs_dir(is_local: bool | None = None) -> Path:
    if is_local is None:
        is_local = get_local_qgraph_dir() is not None
    if is_local:
        local = get_local_qgraph_dir()
        if local:
            d = local / "logs"
            d.mkdir(parents=True, exist_ok=True)
            return d
    logs_dir = get_qgraph_home() / "logs"
    logs_dir.mkdir(parents=True, exist_ok=True)
    return logs_dir


def get_all_logs_dirs() -> list[Path]:
    dirs = [get_qgraph_home() / "logs"]
    local = get_local_qgraph_dir()
    if local:
        dirs.append(local / "logs")
    for d in dirs:
        d.mkdir(parents=True, exist_ok=True)
    return dirs


def get_running_dir(is_local: bool | None = None) -> Path:
    if is_local is None:
        is_local = get_local_qgraph_dir() is not None
    if is_local:
        local = get_local_qgraph_dir()
        if local:
            d = local / "running"
            d.mkdir(parents=True, exist_ok=True)
            return d
    d = get_qgraph_home() / "running"
    d.mkdir(parents=True, exist_ok=True)
    return d


def get_all_running_dirs() -> list[Path]:
    dirs = [get_qgraph_home() / "running"]
    local = get_local_qgraph_dir()
    if local:
        dirs.append(local / "running")
    for d in dirs:
        d.mkdir(parents=True, exist_ok=True)
    return dirs


def get_live_logs_dir(is_local: bool | None = None) -> Path:
    if is_local is None:
        is_local = get_local_qgraph_dir() is not None
    if is_local:
        local = get_local_qgraph_dir()
        if local:
            d = local / "live_logs"
            d.mkdir(parents=True, exist_ok=True)
            return d
    d = get_qgraph_home() / "live_logs"
    d.mkdir(parents=True, exist_ok=True)
    return d


def get_all_live_logs_dirs() -> list[Path]:
    dirs = [get_qgraph_home() / "live_logs"]
    local = get_local_qgraph_dir()
    if local:
        dirs.append(local / "live_logs")
    for d in dirs:
        d.mkdir(parents=True, exist_ok=True)
    return dirs


def is_local_mode() -> bool:
    return get_local_qgraph_dir() is not None


class GraphStorage:
    def __init__(self):
        self._local_dir = get_local_qgraph_dir()

    @property
    def graphs_dir(self) -> Path:
        if self._local_dir:
            d = self._local_dir / "graphs"
            d.mkdir(parents=True, exist_ok=True)
            return d
        return get_global_graphs_dir()

    def _graph_path(self, name: str) -> Path:
        if self._local_dir:
            local_path = self._local_dir / "graphs" / f"{name}.json"
            if local_path.exists():
                return local_path
        global_path = get_global_graphs_dir() / f"{name}.json"
        if global_path.exists():
            return global_path
        return self.graphs_dir / f"{name}.json"

    def _all_graph_paths(self) -> dict[str, Path]:
        paths: dict[str, Path] = {}
        for p in sorted(get_global_graphs_dir().glob("*.json")):
            paths[p.stem] = p
        if self._local_dir:
            local_graphs = self._local_dir / "graphs"
            if local_graphs.is_dir():
                for p in sorted(local_graphs.glob("*.json")):
                    paths[p.stem] = p
        return paths

    def list_graphs(self) -> list[dict[str, Any]]:
        results = []
        for name, path in sorted(self._all_graph_paths().items()):
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
                is_local = self._local_dir and str(
                    path
                ).startswith(str(self._local_dir))
                results.append({
                    "name": data.get("name", name),
                    "created_at": data.get("created_at", ""),
                    "updated_at": data.get("updated_at", ""),
                    "node_count": len(data.get("nodes", [])),
                    "local": bool(is_local),
                })
            except (json.JSONDecodeError, OSError):
                continue
        results.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        return results

    def create_graph(self, name: str) -> dict[str, Any]:
        path = self.graphs_dir / f"{name}.json"
        if path.exists():
            raise FileExistsError(f"Graph '{name}' already exists")

        now = datetime.now(timezone.utc).isoformat()
        data: dict[str, Any] = {
            "name": name,
            "description": "",
            "nodes": [],
            "edges": [],
            "created_at": now,
            "updated_at": now,
            "project_dir": os.getcwd(),
        }

        path.write_text(
            json.dumps(data, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )
        return data

    def load_graph(self, name: str) -> dict[str, Any] | None:
        path = self._graph_path(name)
        if not path.exists():
            return None
        data = json.loads(path.read_text(encoding="utf-8"))
        if "project_dir" not in data:
            data["project_dir"] = os.getcwd()
            path.write_text(
                json.dumps(data, indent=2, ensure_ascii=False),
                encoding="utf-8",
            )
        return data

    def save_graph(self, name: str, data: dict[str, Any]) -> None:
        data["name"] = name
        data["updated_at"] = datetime.now(timezone.utc).isoformat()
        if "created_at" not in data or not data["created_at"]:
            data["created_at"] = data["updated_at"]
        path = self._graph_path(name)
        if not path.exists():
            path = self.graphs_dir / f"{name}.json"
        if "project_dir" not in data:
            data["project_dir"] = os.getcwd()
        path.write_text(
            json.dumps(data, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )

    def delete_graph(self, name: str) -> bool:
        path = self._graph_path(name)
        if not path.exists():
            return False
        try:
            path.unlink()
        except OSError:
            pass
        if path.exists():
            os.remove(str(path))
        if path.exists():
            raise OSError(f"Failed to delete file: {path}")
        return True

    def graph_exists(self, name: str) -> bool:
        return self._graph_path(name).exists()

    def is_graph_local(self, name: str) -> bool:
        if not self._local_dir:
            return False
        local_path = self._local_dir / "graphs" / f"{name}.json"
        return local_path.exists()

    @staticmethod
    def init_local() -> Path:
        local = Path.cwd() / ".qgraph" / "graphs"
        local.mkdir(parents=True, exist_ok=True)
        return local.parent
