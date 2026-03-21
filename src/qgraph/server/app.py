from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from qgraph.server.api import router as api_router
from qgraph.server.ws import router as ws_router

STATIC_DIR = Path(__file__).parent.parent / "web" / "dist"


def create_app() -> FastAPI:
    app = FastAPI(
        title="QGraph",
        version="0.1.0",
        description="Visual Pipeline Editor API",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(api_router, prefix="/api")
    app.include_router(ws_router, prefix="/ws")

    if STATIC_DIR.exists():
        app.mount("/", StaticFiles(directory=str(STATIC_DIR), html=True), name="static")

    return app
