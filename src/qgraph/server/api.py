from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException

from qgraph.core.storage import GraphStorage
from qgraph.engine.run_manager import RunManager, run_manager
from qgraph.server.ws import emit_log, emit_status

router = APIRouter()
storage = GraphStorage()

run_manager.set_callbacks(on_log=emit_log, on_status=emit_status)


@router.get("/graphs")
async def list_graphs() -> list[dict[str, Any]]:
    return storage.list_graphs()


@router.post("/graphs/{name}")
async def create_graph(name: str) -> dict[str, Any]:
    try:
        return storage.create_graph(name)
    except FileExistsError:
        raise HTTPException(status_code=409, detail=f"Graph '{name}' already exists")


@router.get("/graphs/{name}")
async def get_graph(name: str) -> dict[str, Any]:
    data = storage.load_graph(name)
    if data is None:
        raise HTTPException(status_code=404, detail=f"Graph '{name}' not found")
    return data


@router.put("/graphs/{name}")
async def save_graph(name: str, data: dict[str, Any]) -> dict[str, str]:
    storage.save_graph(name, data)
    return {"status": "ok"}


@router.delete("/graphs/{name}")
async def delete_graph(name: str) -> dict[str, str]:
    try:
        if not storage.delete_graph(name):
            raise HTTPException(status_code=404, detail=f"Graph '{name}' not found")
    except OSError as e:
        raise HTTPException(status_code=500, detail=str(e))
    return {"status": "ok"}


@router.post("/graphs/{name}/delete")
async def delete_graph_post(name: str) -> dict[str, str]:
    try:
        if not storage.delete_graph(name):
            raise HTTPException(status_code=404, detail=f"Graph '{name}' not found")
    except OSError as e:
        raise HTTPException(status_code=500, detail=str(e))
    return {"status": "ok"}


@router.post("/graphs/{name}/run")
async def run_graph(name: str) -> dict[str, Any]:
    data = storage.load_graph(name)
    if data is None:
        raise HTTPException(status_code=404, detail=f"Graph '{name}' not found")

    run_id = await run_manager.start_run(name, data)
    return {"status": "started", "run_id": run_id}


@router.get("/runs")
async def list_runs(all: bool = False) -> list[dict[str, Any]]:
    return run_manager.list_runs(include_finished=all)


@router.get("/runs/history")
async def list_run_history() -> list[dict[str, Any]]:
    return RunManager.list_saved_logs()


@router.get("/runs/{run_id}/logs")
async def get_run_logs(run_id: str) -> dict[str, Any]:
    data = RunManager.load_log(run_id)
    if data is None:
        raise HTTPException(status_code=404, detail=f"Logs for run '{run_id}' not found")
    return data


@router.post("/runs/{run_id}/stop")
async def stop_run(run_id: str) -> dict[str, str]:
    if not await run_manager.stop_run(run_id):
        raise HTTPException(status_code=404, detail=f"Run '{run_id}' not found or already finished")
    return {"status": "stopped"}


@router.post("/runs/{run_id}/delete")
async def delete_run_log(run_id: str) -> dict[str, str]:
    if not RunManager.delete_log(run_id):
        raise HTTPException(status_code=404, detail=f"Log '{run_id}' not found")
    return {"status": "ok"}
