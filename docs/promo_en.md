# Show r/Python: QGraph - Visual Pipeline Tool for Scripts (pip install, zero config)

I built QGraph because I was tired of managing dozens of training/preprocessing scripts with messy shell scripts. I wanted something visual, lightweight, and that doesn't require me to learn Airflow or set up databases.

## What is it?

QGraph is a visual DAG pipeline tool. You drag nodes, connect them, and run. It works with your **existing scripts** - no decorators, no SDK, no code changes.

```
pip install qgraph
qgraph serve
# Open http://localhost:9800
```

## Key Features

- **Visual editor** - Drag & drop nodes, connect with lines, see your pipeline
- **5 node types** - Shell Command, Python Script, Python Function, Input, Output
- **Parallel execution** - Independent nodes run in parallel automatically
- **Quick Add** - Double-click canvas, paste a command (or multi-line script), nodes are created automatically
- **Resume from failure** - Pipeline fails? Fix the broken node, click Resume, skip already-succeeded nodes
- **CLI + Web UI** - Both work identically. `qgraph run my-pipeline` doesn't need a server
- **Zero infrastructure** - No database, no Redis, no Docker. Just `pip install`

## Why not Airflow / Prefect / Makefile?

| | QGraph | Airflow | Prefect | Makefile |
|---|---|---|---|---|
| Install | `pip install` | DB + Scheduler + Web | pip + Cloud | built-in |
| Visual editing | Drag & drop | View only | View only | None |
| Code invasion | Zero | DAG DSL | Decorators | Makefile syntax |
| Use existing scripts | Directly | Wrap as Operator | Wrap as Task | Rewrite |

QGraph sits between Makefile (too primitive) and Airflow (too heavy).

## Quick Add (my favorite feature)

Double-click the canvas and paste:

```
cd /data/project
python prepare.py --input raw/
python train.py --epochs 50
python evaluate.py
bash deploy.sh
```

It auto-creates 4 nodes with serial connections. All inherit `working_dir=/data/project`.

## AI-Native

`qgraph init` generates a `QGRAPH.md` file in your project root. Any AI coding tool (Cursor, Trae, Copilot, Claude, etc.) will read it and understand how to create and run pipelines for you.

```
You: "Create a pipeline: prepare.py -> train.py + evaluate.py (parallel) -> export.py"
AI: (writes JSON to .qgraph/graphs/, suggests `qgraph run`)
```

## Tech Stack

- Backend: Python + FastAPI + asyncio
- Frontend: React + React Flow (bundled in the pip package, no Node.js needed)
- Storage: JSON files (git-friendly)
- ~1200 lines Python, ~2500 lines TypeScript

## Links

- GitHub: https://github.com/xiaoqiang-cheng/QGraph
- PyPI: https://pypi.org/project/qgraph/

Would love to hear your feedback! What features would make this useful for your workflow?
