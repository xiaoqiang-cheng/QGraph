from __future__ import annotations

import enum
from typing import Any

from pydantic import BaseModel, Field


class NodeType(str, enum.Enum):
    SHELL_COMMAND = "shell_command"
    PYTHON_SCRIPT = "python_script"
    PYTHON_FUNCTION = "python_function"
    INPUT = "input"
    OUTPUT = "output"


class NodeStatus(str, enum.Enum):
    IDLE = "idle"
    QUEUED = "queued"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    SKIPPED = "skipped"
    CANCELLED = "cancelled"


class Position(BaseModel):
    x: float = 0.0
    y: float = 0.0


class Port(BaseModel):
    id: str
    name: str
    data_type: str = "any"


class NodeConfig(BaseModel):
    command: str | None = None
    working_dir: str | None = None
    env_vars: dict[str, str] = Field(default_factory=dict)
    script_path: str | None = None
    args: list[str] = Field(default_factory=list)
    python_path: str | None = None
    module_path: str | None = None
    function_name: str | None = None
    kwargs: dict[str, Any] = Field(default_factory=dict)
    parameters: dict[str, Any] = Field(default_factory=dict)


class Node(BaseModel):
    id: str
    name: str
    node_type: NodeType
    position: Position = Field(default_factory=Position)
    inputs: list[Port] = Field(default_factory=list)
    outputs: list[Port] = Field(default_factory=list)
    config: NodeConfig = Field(default_factory=NodeConfig)
    status: NodeStatus = NodeStatus.IDLE


class Edge(BaseModel):
    id: str
    source: str
    source_port: str
    target: str
    target_port: str


class Graph(BaseModel):
    name: str
    description: str = ""
    nodes: list[Node] = Field(default_factory=list)
    edges: list[Edge] = Field(default_factory=list)
    created_at: str = ""
    updated_at: str = ""


class ExecutionResult(BaseModel):
    node_id: str
    status: NodeStatus
    output: dict[str, Any] = Field(default_factory=dict)
    logs: list[str] = Field(default_factory=list)
    error: str | None = None
    duration_ms: float = 0.0
