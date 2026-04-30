"""Kiro Suite - unified account manager + API gateway"""
import asyncio
import json
import os
import sys
from contextlib import asynccontextmanager
from pathlib import Path

import httpx
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse

from core.db import init_db
from core.registry import load_all
from api.accounts import router as accounts_router
from api.tasks import router as tasks_router
from api.platforms import router as platforms_router
from api.proxies import router as proxies_router
from api.config import router as config_router
from api.actions import router as actions_router
from api.integrations import router as integrations_router
from api.auth import router as auth_router
from api.mail_imports import router as mail_imports_router
from api.outlook import router as outlook_router
from api.contribution import router as contribution_router

from kiro.routes_openai import router as openai_router
from kiro.routes_anthropic import router as anthropic_router
from kiro.exceptions import validation_exception_handler
from fastapi.exceptions import RequestValidationError

EXPECTED_CONDA_ENV = os.getenv("APP_CONDA_ENV", "any-auto-register")


def _detect_conda_env() -> str:
    conda_env = os.getenv("CONDA_DEFAULT_ENV")
    if conda_env:
        return conda_env
    prefix_parts = os.path.normpath(sys.prefix).split(os.sep)
    if "envs" in prefix_parts:
        idx = prefix_parts.index("envs")
        if idx + 1 < len(prefix_parts):
            return prefix_parts[idx + 1]
    return ""


def _print_runtime_info() -> None:
    current_env = _detect_conda_env()
    print(f"[Runtime] Python: {sys.executable}")
    print(f"[Runtime] Conda Env: {current_env or 'not detected'}")
    if EXPECTED_CONDA_ENV == "docker":
        return
    if current_env and current_env != EXPECTED_CONDA_ENV:
        print(f"[WARN] Current env '{current_env}', recommended: '{EXPECTED_CONDA_ENV}'")


def _get_db_path() -> str:
    db_url = os.getenv("DATABASE_URL", "sqlite:///account_manager.db")
    # Support both relative and absolute sqlite paths
    db_path = db_url.replace("sqlite:///", "")
    runtime_dir = os.getenv("APP_RUNTIME_DIR", "")
    if runtime_dir and not os.path.isabs(db_path):
        db_path = os.path.join(runtime_dir, db_path)
    return db_path


async def _init_gateway(app: FastAPI) -> tuple:
    """Initialize gateway components. Returns (account_manager, save_task)."""
    from kiro.db_source import load_kiro_credentials
    from kiro.account_manager import AccountManager
    from kiro.config import STREAMING_READ_TIMEOUT

    gateway_creds_file = os.getenv(
        "GATEWAY_CREDS_FILE",
        os.path.join(os.getenv("APP_RUNTIME_DIR", "/data/runtime"), "gateway_credentials.json")
    )
    gateway_state_file = os.path.join(
        os.path.dirname(gateway_creds_file), "gateway_state.json"
    )

    # Generate credentials.json from DB
    db_path = _get_db_path()
    region = os.getenv("KIRO_REGION", "us-east-1")
    creds = load_kiro_credentials(db_path, region)

    Path(gateway_creds_file).parent.mkdir(parents=True, exist_ok=True)
    with open(gateway_creds_file, "w", encoding="utf-8") as f:
        json.dump(creds, f, indent=2, ensure_ascii=False)
    print(f"[OK] Gateway: {len(creds)} Kiro account(s) loaded")

    # Shared HTTP client
    limits = httpx.Limits(
        max_connections=100,
        max_keepalive_connections=20,
        keepalive_expiry=30.0,
    )
    timeout = httpx.Timeout(
        connect=30.0,
        read=STREAMING_READ_TIMEOUT,
        write=30.0,
        pool=30.0,
    )
    app.state.http_client = httpx.AsyncClient(
        limits=limits, timeout=timeout, follow_redirects=True
    )

    # AccountManager
    manager = AccountManager(
        credentials_file=gateway_creds_file,
        state_file=gateway_state_file,
    )
    await manager.load_credentials()
    await manager.load_state()
    app.state.account_manager = manager
    app.state.account_system = True

    # Try to initialize at least one account
    all_ids = list(manager._accounts.keys())
    initialized = False
    for account_id in all_ids:
        if await manager._initialize_account(account_id):
            print(f"[OK] Gateway account ready: {account_id}")
            initialized = True
            break

    if not initialized:
        if all_ids:
            print("[WARN] Gateway: no Kiro accounts could be initialized (check tokens)")
        else:
            print("[INFO] Gateway: no Kiro accounts yet — register accounts first")
        # Still set a stub so routes don't crash on import
        app.state.account_manager = manager

    save_task = None
    if initialized:
        await manager._save_state()
        save_task = asyncio.create_task(manager.save_state_periodically())

    return manager, save_task


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── any-auto-register ────────────────────────────────────────────────────
    _print_runtime_info()
    init_db()
    load_all()
    print("[OK] Database initialized")
    from core.registry import list_platforms
    print(f"[OK] Platforms loaded: {[p['name'] for p in list_platforms()]}")
    from core.scheduler import scheduler
    scheduler.start()
    from services.solver_manager import start_async
    start_async()

    # ── kiro gateway ─────────────────────────────────────────────────────────
    manager, save_task = await _init_gateway(app)

    yield

    # ── shutdown ─────────────────────────────────────────────────────────────
    from core.scheduler import scheduler as _scheduler
    _scheduler.stop()
    from services.solver_manager import stop
    stop()

    if save_task:
        save_task.cancel()
        try:
            await save_task
        except asyncio.CancelledError:
            pass
        await manager._save_state()

    if hasattr(app.state, "http_client"):
        await app.state.http_client.aclose()


app = FastAPI(title="Kiro Suite", version="1.0.0", lifespan=lifespan)

# ── Validation error handler ─────────────────────────────────────────────────
app.add_exception_handler(RequestValidationError, validation_exception_handler)


# ── Auth middleware (any-auto-register API only) ──────────────────────────────
@app.middleware("http")
async def auth_middleware(request: Request, call_next):
    path = request.url.path
    if path.startswith("/api/auth/") or not path.startswith("/api/"):
        return await call_next(request)
    from core.config_store import config_store as _cs
    if not _cs.get("auth_password_hash", ""):
        return await call_next(request)
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return JSONResponse({"detail": "Unauthorized — please login"}, status_code=401)
    try:
        from api.auth import verify_token
        verify_token(auth_header[7:])
    except HTTPException as e:
        return JSONResponse({"detail": e.detail}, status_code=e.status_code)
    return await call_next(request)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── any-auto-register routes (/api/...) ───────────────────────────────────────
app.include_router(accounts_router, prefix="/api")
app.include_router(tasks_router, prefix="/api")
app.include_router(platforms_router, prefix="/api")
app.include_router(proxies_router, prefix="/api")
app.include_router(config_router, prefix="/api")
app.include_router(actions_router, prefix="/api")
app.include_router(integrations_router, prefix="/api")
app.include_router(auth_router, prefix="/api")
app.include_router(mail_imports_router, prefix="/api")
app.include_router(outlook_router, prefix="/api")
app.include_router(contribution_router, prefix="/api")


@app.get("/api/solver/status")
def solver_status():
    from services.solver_manager import is_running
    return {"running": is_running()}


@app.post("/api/solver/restart")
def solver_restart():
    from services.solver_manager import stop, start_async
    stop()
    start_async()
    return {"message": "Restarting"}


# ── Reload gateway credentials from DB ───────────────────────────────────────
@app.post("/api/gateway/reload", tags=["gateway"])
async def reload_gateway(request: Request):
    """Reload Kiro credentials from database into the gateway."""
    manager, _ = await _init_gateway(request.app)
    return {"message": "Gateway reloaded", "accounts": len(manager._accounts)}


# ── Gateway routes (/v1/...) ──────────────────────────────────────────────────
app.include_router(openai_router)   # /health, /v1/models, /v1/chat/completions
app.include_router(anthropic_router)  # /v1/messages


# ── SPA static files (must be last) ──────────────────────────────────────────
_static_dir = os.path.join(os.path.dirname(__file__), "static")
if os.path.isdir(_static_dir):
    app.mount("/assets", StaticFiles(directory=os.path.join(_static_dir, "assets")), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def spa_fallback(full_path: str):
        return FileResponse(os.path.join(_static_dir, "index.html"))


if __name__ == "__main__":
    import uvicorn

    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    reload_enabled = os.getenv("APP_RELOAD", "0").lower() in {"1", "true", "yes"}
    uvicorn.run("main:app", host=host, port=port, reload=reload_enabled)
