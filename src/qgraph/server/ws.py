from __future__ import annotations

import asyncio
import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()


class ConnectionManager:
    def __init__(self):
        self._connections: dict[str, list[WebSocket]] = {}

    async def connect(self, ws: WebSocket, channel: str):
        await ws.accept()
        if channel not in self._connections:
            self._connections[channel] = []
        self._connections[channel].append(ws)

    def disconnect(self, ws: WebSocket, channel: str):
        if channel in self._connections:
            self._connections[channel] = [
                c for c in self._connections[channel] if c is not ws
            ]

    async def broadcast(self, channel: str, message: dict):
        if channel not in self._connections:
            return
        data = json.dumps(message)
        disconnected = []
        for ws in self._connections[channel]:
            try:
                await ws.send_text(data)
            except Exception:
                disconnected.append(ws)
        for ws in disconnected:
            self.disconnect(ws, channel)

    async def broadcast_to_all(self, message: dict):
        data = json.dumps(message)
        disconnected_pairs = []
        for channel, connections in self._connections.items():
            for ws in connections:
                try:
                    await ws.send_text(data)
                except Exception:
                    disconnected_pairs.append((ws, channel))
        for ws, channel in disconnected_pairs:
            self.disconnect(ws, channel)


manager = ConnectionManager()


async def emit_log(graph_name: str, node_id: str, message: str, run_id: str = ""):
    await manager.broadcast(f"graph:{graph_name}", {
        "type": "log",
        "graph_name": graph_name,
        "node_id": node_id,
        "message": message,
        "run_id": run_id,
    })


async def emit_status(graph_name: str, node_id: str, status: str, run_id: str = ""):
    await manager.broadcast(f"graph:{graph_name}", {
        "type": "node_status",
        "graph_name": graph_name,
        "node_id": node_id,
        "status": status,
        "run_id": run_id,
    })
    await manager.broadcast("dashboard", {
        "type": "run_update",
        "graph_name": graph_name,
        "node_id": node_id,
        "status": status,
        "run_id": run_id,
    })


@router.websocket("/graph/{graph_name}")
async def websocket_graph(ws: WebSocket, graph_name: str):
    channel = f"graph:{graph_name}"
    await manager.connect(ws, channel)
    try:
        while True:
            try:
                data = await asyncio.wait_for(ws.receive_text(), timeout=30)
                msg = json.loads(data)
                if msg.get("type") == "ping":
                    await ws.send_text(json.dumps({"type": "pong"}))
            except asyncio.TimeoutError:
                await ws.send_text(json.dumps({"type": "ping"}))
    except WebSocketDisconnect:
        manager.disconnect(ws, channel)


@router.websocket("/dashboard")
async def websocket_dashboard(ws: WebSocket):
    await manager.connect(ws, "dashboard")
    try:
        while True:
            try:
                data = await asyncio.wait_for(ws.receive_text(), timeout=30)
                msg = json.loads(data)
                if msg.get("type") == "ping":
                    await ws.send_text(json.dumps({"type": "pong"}))
            except asyncio.TimeoutError:
                await ws.send_text(json.dumps({"type": "ping"}))
    except WebSocketDisconnect:
        manager.disconnect(ws, "dashboard")
