from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException

from qgraph.core.storage import GraphStorage
from qgraph.engine.run_manager import RunManager, run_manager
from qgraph.server.ws import emit_log, emit_status
from qgraph.server.ws import manager as ws_manager

router = APIRouter()
storage = GraphStorage()

run_manager.set_callbacks(on_log=emit_log, on_status=emit_status)

_active_tests: dict[str, Any] = {}


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
async def run_graph(name: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
    data = storage.load_graph(name)
    if data is None:
        raise HTTPException(status_code=404, detail=f"Graph '{name}' not found")

    skip_nodes: set[str] | None = None
    if payload and payload.get("skip_nodes"):
        skip_nodes = set(payload["skip_nodes"])

    run_id = await run_manager.start_run(name, data, skip_nodes=skip_nodes)
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


@router.post("/nodes/test")
async def test_node(payload: dict[str, Any]) -> dict[str, Any]:
    import asyncio as _asyncio

    node_type = payload.get("node_type")
    config = payload.get("config", {})
    timeout = min(payload.get("timeout", 30), 120)
    graph_name = payload.get("graph_name", "__test__")
    test_id = payload.get("test_id")
    if not test_id:
        import time as _time

        test_id = f"test_{id(payload)}_{int(_time.time() * 1000)}"

    if not node_type:
        raise HTTPException(status_code=400, detail="node_type is required")

    test_node_data = {
        "id": "__test__",
        "name": "Test Node",
        "node_type": node_type,
        "position": {"x": 0, "y": 0},
        "inputs": [],
        "outputs": [],
        "config": config,
        "status": "idle",
    }

    graph_data = {
        "name": graph_name,
        "description": "",
        "nodes": [test_node_data],
        "edges": [],
    }

    collected_logs: list[str] = []
    ws_channel = f"graph:{graph_name}"

    async def on_log(_gn: str, node_id: str, message: str):
        collected_logs.append(message)
        await ws_manager.broadcast(ws_channel, {
            "type": "test_log",
            "graph_name": graph_name,
            "node_id": node_id,
            "message": message,
            "test_id": test_id,
        })

    async def on_status(_gn: str, node_id: str, status: str):
        await ws_manager.broadcast(ws_channel, {
            "type": "test_status",
            "graph_name": graph_name,
            "node_id": node_id,
            "status": status,
            "test_id": test_id,
        })

    from qgraph.engine.executor import PipelineExecutor

    executor = PipelineExecutor(on_log=on_log, on_status=on_status)
    _active_tests[test_id] = executor

    try:
        results = await _asyncio.wait_for(
            executor.execute(graph_data), timeout=timeout
        )
    except _asyncio.TimeoutError:
        executor.cancel()
        return {
            "status": "timeout",
            "logs": collected_logs,
            "error": f"Test timed out after {timeout}s",
            "test_id": test_id,
        }
    except _asyncio.CancelledError:
        return {
            "status": "cancelled",
            "logs": collected_logs,
            "error": "Test cancelled by user",
            "test_id": test_id,
        }
    finally:
        _active_tests.pop(test_id, None)

    result = results.get("__test__")
    if result is None:
        return {"status": "error", "logs": collected_logs, "error": "No result", "test_id": test_id}

    return {
        "status": result.status.value,
        "logs": collected_logs,
        "error": result.error,
        "duration_ms": result.duration_ms,
        "test_id": test_id,
    }


@router.post("/nodes/test/stop")
async def stop_test_node(payload: dict[str, Any]) -> dict[str, str]:
    test_id = payload.get("test_id", "")
    executor = _active_tests.get(test_id)
    if not executor:
        raise HTTPException(status_code=404, detail="Test not found or already finished")
    executor.cancel()
    _active_tests.pop(test_id, None)
    return {"status": "stopped"}
