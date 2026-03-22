# QGraph - Visual Pipeline Tool

This project uses QGraph for pipeline orchestration. QGraph lets you organize scripts into visual DAG workflows.

## Quick Reference

```bash
qgraph serve              # Start Web UI at http://localhost:9800
qgraph list               # List all pipelines
qgraph create <name>      # Create a new pipeline
qgraph run <name>         # Run a pipeline (no server needed)
qgraph ps                 # List running tasks
qgraph ps -a              # List all execution history
qgraph logs <run_id>      # View execution logs
```

## When to Use QGraph

Use QGraph when the user needs to:
- Run multiple scripts in a specific order
- Execute tasks with dependencies (DAG)
- Set up training/preprocessing/deployment pipelines
- Orchestrate shell commands and Python scripts together

## Creating Pipelines via CLI

```bash
# Create and run
qgraph create my-pipeline
qgraph serve   # Edit visually at http://localhost:9800
qgraph run my-pipeline
```

## Pipeline JSON Structure

Pipelines are stored as JSON in `.qgraph/graphs/`. You can create them programmatically:

```json
{
  "name": "example-pipeline",
  "nodes": [
    {
      "id": "n1",
      "name": "Prepare Data",
      "node_type": "python_script",
      "position": {"x": 100, "y": 200},
      "inputs": [{"id": "in_0", "name": "input", "data_type": "any"}],
      "outputs": [{"id": "out_0", "name": "output", "data_type": "any"}],
      "config": {
        "script_path": "./scripts/prepare.py",
        "args": ["--input", "raw/"],
        "working_dir": "./",
        "env_vars": {"DATA_DIR": "/data"}
      },
      "status": "idle"
    }
  ],
  "edges": [
    {
      "id": "e1",
      "source": "n1", "source_port": "out_0",
      "target": "n2", "target_port": "in_0"
    }
  ]
}
```

## Node Types

| Type | Use For | Key Config |
|------|---------|-----------|
| `shell_command` | Bash/shell commands | `command`, `working_dir`, `env_vars` |
| `python_script` | Python scripts (.py) | `script_path`, `args`, `python_path`, `env_vars` |
| `python_function` | Python functions | `module_path`, `function_name` |
| `input` | Global parameters | `parameters` (key-value pairs, injected as env vars to all downstream) |
| `output` | Pipeline endpoint | (no config) |

## Execution Behavior

- Nodes without dependencies run in parallel automatically
- If a node fails, all downstream nodes are skipped
- Use `qgraph run <name>` for CLI execution (logs to `.qgraph/logs/`)
- Input node parameters are injected as environment variables to all downstream nodes
- Each node's `working_dir` overrides the graph-level `project_dir`

## Storage

```
.qgraph/
├── graphs/     # Pipeline definitions (JSON)
├── logs/       # Execution logs
└── running/    # Running process state (PID files)
```

## Tips for AI Assistants

- When creating pipelines programmatically, write JSON directly to `.qgraph/graphs/<name>.json`
- Always include `position` for each node (for visual layout)
- Use `in_0`/`out_0` for port IDs
- Set `project_dir` to the project root directory
- After creating a JSON file, user can run `qgraph run <name>` immediately
- For quick visual editing, suggest `qgraph serve` and open the browser
