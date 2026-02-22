"""API v1 router aggregation."""
# ruff: noqa: I001 - Imports structured for Jinja2 template conditionals

from fastapi import APIRouter

from app.api.routes.v1 import health
from app.api.routes.v1 import ws
from app.api.routes.v1 import games

v1_router = APIRouter()

# Health check routes (no auth required)
v1_router.include_router(health.router, tags=["health"])

# Game routes
v1_router.include_router(games.router, tags=["games"])

# WebSocket routes
v1_router.include_router(ws.router, tags=["websocket"])
