import click

from qgraph import __version__


@click.group()
@click.version_option(version=__version__, prog_name="qgraph")
def main():
    """QGraph - Visual Pipeline Editor for Workflow Orchestration"""
    pass


@main.command()
@click.option("--port", default=9800, help="Port to run the server on")
@click.option("--host", default="0.0.0.0", help="Host to bind the server to")
def serve(port: int, host: str):
    """Start the QGraph web UI server."""
    import uvicorn

    from qgraph.server.app import create_app

    app = create_app()
    click.echo(f"Starting QGraph server at http://{host}:{port}")
    uvicorn.run(app, host=host, port=port)


@main.command("list")
def list_graphs():
    """List all saved graphs."""
    from qgraph.core.storage import GraphStorage

    storage = GraphStorage()
    graphs = storage.list_graphs()
    if not graphs:
        click.echo("No graphs found. Create one with: qgraph create <name>")
        return
    from rich.console import Console
    from rich.table import Table

    console = Console()
    table = Table(title="QGraph Pipelines")
    table.add_column("Name", style="cyan")
    table.add_column("Created", style="green")
    table.add_column("Updated", style="yellow")
    table.add_column("Nodes", justify="right")

    for g in graphs:
        table.add_row(g["name"], g["created_at"], g["updated_at"], str(g["node_count"]))

    console.print(table)


@main.command()
@click.argument("name")
def create(name: str):
    """Create a new graph and open it in the web UI."""
    from qgraph.core.storage import GraphStorage

    storage = GraphStorage()
    storage.create_graph(name)
    click.echo(f"Created graph: {name}")
    click.echo(f"Open in browser: http://127.0.0.1:9800/editor/{name}")


@main.command()
@click.argument("name")
def edit(name: str):
    """Open a graph in the web UI for editing."""
    click.echo(f"Open in browser: http://127.0.0.1:9800/editor/{name}")


@main.command()
@click.argument("name")
@click.option("-d", "--detach", is_flag=True, help="Run in background")
def run(name: str, detach: bool):
    """Execute a graph pipeline."""
    import asyncio
    import sys

    from rich.console import Console

    from qgraph.core.models import NodeStatus
    from qgraph.core.storage import GraphStorage
    from qgraph.engine.executor import PipelineExecutor

    console = Console()
    storage = GraphStorage()
    graph_data = storage.load_graph(name)
    if graph_data is None:
        console.print(f"[red]Graph '{name}' not found.[/red]")
        raise SystemExit(1)

    console.print(f"[bold cyan]Running graph:[/bold cyan] {name}")
    console.print()

    all_logs: list[str] = []

    async def on_log(_gn: str, node_id: str, message: str):
        console.print(f"  {message}")
        all_logs.append(message)

    async def on_status(_gn: str, node_id: str, status: str):
        style = {
            "running": "bold yellow",
            "success": "bold green",
            "failed": "bold red",
            "queued": "dim",
            "skipped": "dim yellow",
        }.get(status, "")
        icon = {
            "running": "⟳",
            "success": "✓",
            "failed": "✗",
            "queued": "◦",
            "skipped": "⊘",
        }.get(status, "○")
        console.print(f"  [{style}]{icon} [{node_id}] → {status}[/{style}]")

    executor = PipelineExecutor(on_log=on_log, on_status=on_status)
    results = asyncio.run(executor.execute(graph_data))

    console.print()
    failed = sum(1 for r in results.values() if r.status == NodeStatus.FAILED)
    skipped = sum(1 for r in results.values() if r.status == NodeStatus.SKIPPED)
    succeeded = sum(1 for r in results.values() if r.status == NodeStatus.SUCCESS)

    if failed > 0:
        parts = [f"{succeeded} succeeded", f"{failed} failed"]
        if skipped > 0:
            parts.append(f"{skipped} skipped")
        msg = ", ".join(parts)
        console.print(f"[bold red]Pipeline finished with errors: {msg}[/bold red]")
        sys.exit(1)
    else:
        console.print(
            f"[bold green]Pipeline completed successfully: "
            f"{succeeded} nodes[/bold green]"
        )


@main.command()
@click.option("-a", "--all", "show_all", is_flag=True, help="Show all executions including finished")
def ps(show_all: bool):
    """List running graph executions (requires server running)."""
    import json
    import urllib.request

    url = "http://127.0.0.1:9800/api/runs"
    if show_all:
        url += "?all=true"

    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=3) as resp:
            runs = json.loads(resp.read().decode())
    except Exception:
        if show_all:
            from qgraph.engine.run_manager import RunManager
            saved = RunManager.list_saved_logs()
            if not saved:
                click.echo("No executions found.")
                return
            from rich.console import Console
            from rich.table import Table

            console = Console()
            table = Table(title="Saved Executions (server not running)")
            table.add_column("Run ID", style="cyan")
            table.add_column("Graph", style="green")
            table.add_column("Status", style="yellow")
            table.add_column("Logs", justify="right")
            for e in saved[:20]:
                sc = "green" if e["status"] == "completed" else "red"
                st = f"[{sc}]{e['status']}[/{sc}]"
                table.add_row(
                    e["run_id"], e["graph_name"], st, str(e["log_count"])
                )
            console.print(table)
            return
        click.echo("Could not connect to QGraph server. Is it running? (qgraph serve)")
        return

    if not runs:
        click.echo("No running executions." if not show_all else "No executions found.")
        return

    from rich.console import Console
    from rich.table import Table

    console = Console()
    title = "All Executions" if show_all else "Running Executions"
    table = Table(title=title)
    table.add_column("Run ID", style="cyan")
    table.add_column("Graph", style="green")
    table.add_column("Status", style="yellow")
    table.add_column("Elapsed", justify="right")
    table.add_column("Current Node", style="magenta")

    for r in runs:
        elapsed = f"{r['elapsed_seconds']}s"
        status_style = {
            "running": "[bold yellow]",
            "completed": "[green]",
            "stopped": "[red]",
        }.get(r["status"], "")
        status_end = "[/]" if status_style else ""
        table.add_row(
            r["run_id"],
            r["graph_name"],
            f"{status_style}{r['status']}{status_end}",
            elapsed,
            r.get("current_node") or "-",
        )

    console.print(table)


@main.command()
@click.argument("run_id")
def logs(run_id: str):
    """Show logs for a run. Tries server first, falls back to saved logs."""
    import json
    import urllib.request

    from rich.console import Console

    console = Console()
    log_data = None

    try:
        req = urllib.request.Request(f"http://127.0.0.1:9800/api/runs/{run_id}/logs")
        with urllib.request.urlopen(req, timeout=3) as resp:
            log_data = json.loads(resp.read().decode())
    except Exception:
        pass

    if log_data is None:
        from qgraph.engine.run_manager import RunManager
        log_data = RunManager.load_log(run_id)

    if log_data is None:
        console.print(f"[red]Logs for run '{run_id}' not found.[/red]")
        console.print()
        console.print("Available runs:")
        from qgraph.engine.run_manager import RunManager as RM
        for entry in RM.list_saved_logs()[:10]:
            status_color = "green" if entry["status"] == "completed" else "red"
            console.print(
                f"  [{status_color}]{entry['status']:10}[/{status_color}] "
                f"[cyan]{entry['run_id']}[/cyan]  {entry['graph_name']}"
            )
        raise SystemExit(1)

    console.print(f"[bold cyan]Run:[/bold cyan] {log_data['run_id']}")
    console.print(f"[bold cyan]Graph:[/bold cyan] {log_data['graph_name']}")
    console.print(f"[bold cyan]Status:[/bold cyan] {log_data['status']}")
    console.print(f"[bold cyan]Started:[/bold cyan] {log_data.get('started_at', '')}")
    console.print(f"[bold cyan]Finished:[/bold cyan] {log_data.get('finished_at', '-')}")
    console.print()

    for entry in log_data.get("logs", []):
        if isinstance(entry, dict):
            msg = entry.get("message", "")
            node_id = entry.get("node_id", "")[:12]
            line = f"  [dim][{node_id}][/dim] {msg}"
        else:
            msg = str(entry)
            line = f"  {msg}"
        is_err = "Failed" in msg or "ERROR" in msg or "[stderr]" in msg
        is_ok = "Completed" in msg or "successfully" in msg
        if is_err:
            console.print(f"[red]{line}[/red]")
        elif is_ok:
            console.print(f"[green]{line}[/green]")
        else:
            console.print(line)


@main.command()
@click.argument("name")
def delete(name: str):
    """Delete a graph."""
    from qgraph.core.storage import GraphStorage

    storage = GraphStorage()
    storage.delete_graph(name)
    click.echo(f"Deleted graph: {name}")


@main.command("export")
@click.argument("name")
@click.option("-o", "--output", default=None, help="Output file path")
def export_graph(name: str, output: str | None):
    """Export a graph to a JSON file."""
    import json
    from pathlib import Path

    from qgraph.core.storage import GraphStorage

    storage = GraphStorage()
    graph_data = storage.load_graph(name)
    if graph_data is None:
        click.echo(f"Graph '{name}' not found.", err=True)
        raise SystemExit(1)

    output_path = Path(output) if output else Path(f"{name}.json")
    output_path.write_text(json.dumps(graph_data, indent=2, ensure_ascii=False), encoding="utf-8")
    click.echo(f"Exported graph to: {output_path}")


@main.command("import")
@click.argument("file_path", type=click.Path(exists=True))
def import_graph(file_path: str):
    """Import a graph from a JSON file."""
    import json
    from pathlib import Path

    from qgraph.core.storage import GraphStorage

    data = json.loads(Path(file_path).read_text(encoding="utf-8"))
    storage = GraphStorage()
    name = data.get("name", Path(file_path).stem)
    storage.save_graph(name, data)
    click.echo(f"Imported graph: {name}")


@main.command()
@click.argument("run_id")
def stop(run_id: str):
    """Stop a running graph execution."""
    import json
    import urllib.request

    try:
        req = urllib.request.Request(
            f"http://127.0.0.1:9800/api/runs/{run_id}/stop",
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=3) as resp:
            result = json.loads(resp.read().decode())
            click.echo(f"Stopped: {result.get('status', 'ok')}")
    except Exception as e:
        click.echo(f"Failed to stop run: {e}")


if __name__ == "__main__":
    main()
