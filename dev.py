"""Development script: starts both backend and frontend dev servers."""
import subprocess
import sys
import os
import signal

os.chdir(os.path.dirname(os.path.abspath(__file__)))

backend = subprocess.Popen(
    [sys.executable, "-m", "uvicorn", "qgraph.server.app:create_app", "--factory",
     "--host", "127.0.0.1", "--port", "9800"],
    cwd=os.path.dirname(os.path.abspath(__file__)),
)

frontend = subprocess.Popen(
    ["npm", "run", "dev"],
    cwd=os.path.join(os.path.dirname(os.path.abspath(__file__)), "web"),
    shell=True,
)

try:
    backend.wait()
except KeyboardInterrupt:
    backend.terminate()
    frontend.terminate()
    backend.wait()
    frontend.wait()
