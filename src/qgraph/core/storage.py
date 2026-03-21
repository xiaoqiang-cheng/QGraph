from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def get_qgraph_home() -> Path:
    home = Path.home() / ".qgraph"
    home.mkdir(parents=True, exist_ok=True)
    return home


def get_graphs_dir() -> Path:
    graphs_dir = get_qgraph_home() / "graphs"
    graphs_dir.mkdir(parents=True, exist_ok=True)
    return graphs_dir


def get_logs_dir() -> Path:
    logs_dir = get_qgraph_home() / "logs"
    logs_dir.mkdir(parents=True, exist_ok=True)
    return logs_dir


class GraphStorage:
    def __init__(self):
        self.graphs_dir = get_graphs_dir()

    def _graph_path(self, name: str) -> Path:
        return self.graphs_dir / f"{name}.json"

    def list_graphs(self) -> list[dict[str, Any]]:
        results = []
        for path in sorted(self.graphs_dir.glob("*.json")):
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
                results.append({
                    "name": data.get("name", path.stem),
                    "created_at": data.get("created_at", ""),
                    "updated_at": data.get("updated_at", ""),
                    "node_count": len(data.get("nodes", [])),
                })
            except (json.JSONDecodeError, OSError):
                continue
        return results

    def create_graph(self, name: str) -> dict[str, Any]:
        path = self._graph_path(name)
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
        }
        path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
        return data

    def load_graph(self, name: str) -> dict[str, Any] | None:
        path = self._graph_path(name)
        if not path.exists():
            return None
        return json.loads(path.read_text(encoding="utf-8"))

    def save_graph(self, name: str, data: dict[str, Any]) -> None:
        data["name"] = name
        data["updated_at"] = datetime.now(timezone.utc).isoformat()
        if "created_at" not in data or not data["created_at"]:
            data["created_at"] = data["updated_at"]
        path = self._graph_path(name)
        path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")

    def delete_graph(self, name: str) -> bool:
        path = self._graph_path(name)
        if not path.exists():
            return False
        try:
            path.unlink()
        except OSError:
            pass
        if path.exists():
            import os
            try:
                os.remove(str(path))
            except OSError:
                pass
        if path.exists():
            raise OSError(f"Failed to delete file: {path}")
        return True

    def graph_exists(self, name: str) -> bool:
        return self._graph_path(name).exists()
