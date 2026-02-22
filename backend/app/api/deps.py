"""API dependencies.

Dependency injection factories for services, repositories, and authentication.
"""
# ruff: noqa: I001, E402 - Imports structured for Jinja2 template conditionals

from typing import Annotated

from fastapi import Depends
from app.db.session import get_db_session
from sqlalchemy.ext.asyncio import AsyncSession

# Alias for backwards compatibility
get_db = get_db_session

DBSession = Annotated[AsyncSession, Depends(get_db_session)]
from fastapi import Request

from app.clients.redis import RedisClient


async def get_redis(request: Request) -> RedisClient:
    """Get Redis client from lifespan state."""
    return request.state.redis


Redis = Annotated[RedisClient, Depends(get_redis)]
