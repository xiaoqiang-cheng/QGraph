from __future__ import annotations

import asyncio
import time
from collections import defaultdict
from collections.abc import Callable, Coroutine
from typing import Any

from qgraph.core.models import ExecutionResult, Graph, NodeStatus


class PipelineExecutor:
    def __init__(
        self,
        on_log: Callable[[str, str, str], Coroutine[Any, Any, None]] | None = None,
        on_status: Callable[[str, str, str], Coroutine[Any, Any, None]] | None = None,
    ):
        self._results: dict[str, ExecutionResult] = {}
        self._cancelled = False
        self._on_log = on_log
        self._on_status = on_status

    async def _emit_log(self, graph_name: str, node_id: str, message: str):
        if self._on_log:
            await self._on_log(graph_name, node_id, message)

    async def _emit_status(self, graph_name: str, node_id: str, status: str):
        if self._on_status:
            await self._on_status(graph_name, node_id, status)

    async def execute(
        self,
        graph_data: dict[str, Any],
        skip_nodes: set[str] | None = None,
    ) -> dict[str, ExecutionResult]:
        graph = Graph(**graph_data)
        graph_name = graph.name
        adj: dict[str, list[str]] = defaultdict(list)
        parents: dict[str, list[str]] = defaultdict(list)
        in_degree: dict[str, int] = {node.id: 0 for node in graph.nodes}

        for edge in graph.edges:
            adj[edge.source].append(edge.target)
            parents[edge.target].append(edge.source)
            in_degree[edge.target] = in_degree.get(edge.target, 0) + 1

        queue: list[str] = [nid for nid, deg in in_degree.items() if deg == 0]
        node_map = {node.id: node for node in graph.nodes}
        failed_nodes: set[str] = set()
        _skip = skip_nodes or set()

        inherited_env: dict[str, dict[str, str]] = {}
        for node in graph.nodes:
            if node.node_type.value == "input" and node.config.parameters:
                params = {k: str(v) for k, v in node.config.parameters.items()}
                visited: set[str] = set()
                bfs = list(adj[node.id])
                while bfs:
                    nid = bfs.pop(0)
                    if nid in visited:
                        continue
                    visited.add(nid)
                    if nid not in inherited_env:
                        inherited_env[nid] = {}
                    for k, v in params.items():
                        if k not in inherited_env[nid]:
                            inherited_env[nid][k] = v
                    bfs.extend(adj[nid])

        if _skip:
            pending = list(_skip)
            while pending:
                nid = pending.pop(0)
                if nid not in node_map or nid in self._results:
                    continue
                self._results[nid] = ExecutionResult(
                    node_id=nid, status=NodeStatus.SUCCESS
                )
                await self._emit_log(
                    graph_name, nid,
                    f"[{node_map[nid].name}] Skipped (already succeeded)",
                )
                await self._emit_status(graph_name, nid, "success")
                for neighbor in adj[nid]:
                    in_degree[neighbor] -= 1
                    if in_degree[neighbor] == 0:
                        if neighbor in _skip:
                            pending.append(neighbor)
            queue = [
                nid for nid, deg in in_degree.items()
                if deg == 0 and nid not in self._results
            ]

        for nid in queue:
            await self._emit_status(graph_name, nid, "queued")

        while queue and not self._cancelled:
            tasks = []
            for node_id in queue:
                node = node_map[node_id]
                tasks.append(self._execute_node(
                    graph_name, node_id, node, graph_data,
                    inherited_env.get(node_id, {}),
                ))

            results = await asyncio.gather(*tasks, return_exceptions=True)
            next_queue: list[str] = []

            for node_id, result in zip(queue, results):
                if isinstance(result, Exception):
                    self._results[node_id] = ExecutionResult(
                        node_id=node_id,
                        status=NodeStatus.FAILED,
                        error=str(result),
                    )
                    await self._emit_status(graph_name, node_id, "failed")
                    await self._emit_log(graph_name, node_id, f"ERROR: {result}")
                    failed_nodes.add(node_id)
                else:
                    self._results[node_id] = result
                    if result.status == NodeStatus.FAILED:
                        failed_nodes.add(node_id)

                for neighbor in adj[node_id]:
                    in_degree[neighbor] -= 1
                    if in_degree[neighbor] == 0:
                        has_failed_parent = any(
                            p in failed_nodes for p in parents[neighbor]
                        )
                        if has_failed_parent:
                            skip_queue = [neighbor]
                            while skip_queue:
                                skip_nid = skip_queue.pop(0)
                                if skip_nid in self._results:
                                    continue
                                failed_nodes.add(skip_nid)
                                self._results[skip_nid] = ExecutionResult(
                                    node_id=skip_nid,
                                    status=NodeStatus.SKIPPED,
                                )
                                await self._emit_status(
                                    graph_name, skip_nid, "skipped"
                                )
                                await self._emit_log(
                                    graph_name,
                                    skip_nid,
                                    f"[{node_map[skip_nid].name}] "
                                    f"Skipped: upstream node failed",
                                )
                                for desc in adj[skip_nid]:
                                    in_degree[desc] -= 1
                                    if in_degree[desc] == 0:
                                        skip_queue.append(desc)
                        else:
                            next_queue.append(neighbor)
                            await self._emit_status(
                                graph_name, neighbor, "queued"
                            )

            queue = next_queue

        if self._cancelled:
            for nid, deg in in_degree.items():
                if nid not in self._results:
                    self._results[nid] = ExecutionResult(
                        node_id=nid, status=NodeStatus.CANCELLED
                    )
                    await self._emit_status(graph_name, nid, "cancelled")

        return self._results

    async def _execute_node(
        self,
        graph_name: str,
        node_id: str,
        node: Any,
        graph_data: dict[str, Any],
        extra_env: dict[str, str] | None = None,
    ) -> ExecutionResult:
        start = time.monotonic()
        logs: list[str] = []

        await self._emit_status(graph_name, node_id, "running")

        async def log(msg: str):
            logs.append(msg)
            await self._emit_log(graph_name, node_id, msg)

        try:
            if extra_env:
                await log(
                    f"[{node.name}] Inherited {len(extra_env)} "
                    f"params from Input: {', '.join(extra_env)}"
                )
            await log(f"[{node.name}] Starting execution...")

            if node.node_type.value == "shell_command":
                result = await self._run_shell(node, log, extra_env)
            elif node.node_type.value == "python_script":
                result = await self._run_python_script(node, log, extra_env)
            elif node.node_type.value == "python_function":
                result = await self._run_python_function(node, log)
            elif node.node_type.value == "input":
                result = {"parameters": node.config.parameters}
                await log(f"[{node.name}] Input parameters loaded")
            elif node.node_type.value == "output":
                result = {}
                await log(f"[{node.name}] Output collected")
            else:
                raise ValueError(f"Unknown node type: {node.node_type}")

            duration = (time.monotonic() - start) * 1000
            await log(f"[{node.name}] Completed in {duration:.1f}ms")
            await self._emit_status(graph_name, node_id, "success")

            return ExecutionResult(
                node_id=node_id,
                status=NodeStatus.SUCCESS,
                output=result or {},
                logs=logs,
                duration_ms=duration,
            )
        except Exception as e:
            duration = (time.monotonic() - start) * 1000
            await log(f"[{node.name}] Failed: {e}")
            await self._emit_status(graph_name, node_id, "failed")
            return ExecutionResult(
                node_id=node_id,
                status=NodeStatus.FAILED,
                logs=logs,
                error=str(e),
                duration_ms=duration,
            )

    async def _run_shell(
        self, node: Any, log: Callable, extra_env: dict[str, str] | None = None,
    ) -> dict[str, Any]:
        command = node.config.command
        if not command:
            raise ValueError("Shell command node has no command configured")

        await log(f"[{node.name}] Running: {command}")
        cwd = node.config.working_dir

        import os
        env = {**os.environ, **(extra_env or {}), **(node.config.env_vars or {})}

        process = await asyncio.create_subprocess_shell(
            command,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=cwd,
            env=env,
        )

        async def _read_stream(stream: asyncio.StreamReader, prefix: str):
            while True:
                line = await stream.readline()
                if not line:
                    break
                await log(f"[{prefix}] {line.decode().rstrip()}")

        await asyncio.gather(
            _read_stream(process.stdout, "stdout"),
            _read_stream(process.stderr, "stderr"),
        )
        await process.wait()

        if process.returncode != 0:
            raise RuntimeError(f"Command exited with code {process.returncode}")

        return {"returncode": process.returncode}

    async def _run_python_script(
        self, node: Any, log: Callable, extra_env: dict[str, str] | None = None,
    ) -> dict[str, Any]:
        script_path = node.config.script_path
        if not script_path:
            raise ValueError("Python script node has no script_path configured")

        python_path = node.config.python_path or "python"
        args = node.config.args or []
        cmd = [python_path, script_path, *args]

        await log(f"[{node.name}] Running: {' '.join(cmd)}")

        import os
        env = {**os.environ, **(extra_env or {}), **(node.config.env_vars or {})}

        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=node.config.working_dir,
            env=env,
        )

        async def _read_stream(stream: asyncio.StreamReader, prefix: str):
            while True:
                line = await stream.readline()
                if not line:
                    break
                await log(f"[{prefix}] {line.decode().rstrip()}")

        await asyncio.gather(
            _read_stream(process.stdout, "stdout"),
            _read_stream(process.stderr, "stderr"),
        )
        await process.wait()

        if process.returncode != 0:
            raise RuntimeError(f"Script exited with code {process.returncode}")

        return {"returncode": process.returncode}

    async def _run_python_function(self, node: Any, log: Callable) -> dict[str, Any]:
        module_path = node.config.module_path
        function_name = node.config.function_name

        if not module_path or not function_name:
            raise ValueError("Python function node requires module_path and function_name")

        await log(f"[{node.name}] Calling: {module_path}.{function_name}")

        import importlib
        module = importlib.import_module(module_path)
        func = getattr(module, function_name)

        kwargs = node.config.kwargs or {}
        result = func(**kwargs)

        if asyncio.iscoroutine(result):
            result = await result

        await log(f"[{node.name}] Function returned successfully")
        return {"result": result}

    def cancel(self):
        self._cancelled = True
