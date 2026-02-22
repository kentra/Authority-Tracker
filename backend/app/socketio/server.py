import datetime
import logging

import socketio
from sqlalchemy import select

from app.core.config import settings
from app.db.models.game import ActiveState, BattleLog, Game, PlayerStat
from app.db.session import async_session_maker

logger = logging.getLogger(__name__)

# Try to import background tasks, but don't fail if Redis isn't available
try:
    from app.worker.tasks.ship_ai import process_battle_event, process_status_report

    HAS_BACKGROUND_TASKS = True
except Exception:
    HAS_BACKGROUND_TASKS = False
    logger.warning("Background tasks not available - AI features disabled")

# Configure Socket.IO server
# Use in-memory manager if Redis is not available for development
try:
    mgr = socketio.AsyncRedisManager(
        f"redis://{settings.REDIS_HOST}:{settings.REDIS_PORT}/{settings.REDIS_DB}"
    )
    sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins="*", client_manager=mgr)
    logger.info("Using Redis manager for Socket.IO")
except Exception:
    sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins="*")
    logger.warning("Using in-memory manager for Socket.IO (Redis not available)")


@sio.event
async def connect(sid, environ):
    logger.info(f"Client connected: {sid}")


@sio.event
async def disconnect(sid):
    logger.info(f"Client disconnected: {sid}")


@sio.event
async def start_game(sid, data):
    async with async_session_maker() as db:
        # Create new game
        db_game = Game(player_count=data["players"])
        db.add(db_game)
        await db.commit()
        await db.refresh(db_game)

        # Create PlayerStats
        for i in range(data["players"]):
            db_player = PlayerStat(
                game_id=db_game.id,
                player_name=data["playerNames"][i],
                score=data["authValues"][i],
                is_winner=False,
            )
            db.add(db_player)

        data["game_id"] = db_game.id

        stmt = select(ActiveState)
        result = await db.execute(stmt)
        active_state = result.scalar_one_or_none()

        if not active_state:
            active_state = ActiveState(state_data=data)
            db.add(active_state)
        else:
            active_state.state_data = data
        await db.commit()

    await sio.emit("state_updated", data)


@sio.event
async def state_change(sid, data):
    async with async_session_maker() as db:
        stmt = select(ActiveState)
        result = await db.execute(stmt)
        active_state = result.scalar_one_or_none()

        if not active_state:
            active_state = ActiveState(state_data=data)
            db.add(active_state)
        else:
            # Preserve game_id if not present in incoming data
            if "game_id" not in data and "game_id" in active_state.state_data:
                data["game_id"] = active_state.state_data["game_id"]
            active_state.state_data = data

        # Update PlayerStats continuously
        game_id = data.get("game_id")
        if game_id:
            stmt = select(PlayerStat).where(PlayerStat.game_id == game_id).order_by(PlayerStat.id)
            result = await db.execute(stmt)
            db_players = result.scalars().all()

            if db_players:
                max_score = max(data["authValues"]) if data["authValues"] else 0
                for i, db_player in enumerate(db_players):
                    if i < len(data["authValues"]):
                        db_player.score = data["authValues"][i]
                        db_player.player_name = data["playerNames"][i]
                        db_player.is_winner = data["authValues"][i] == max_score

        await db.commit()

    await sio.emit("state_updated", data, skip_sid=sid)


@sio.event
async def log_action(sid, log_data):
    async with async_session_maker() as db:
        stmt = select(ActiveState)
        result = await db.execute(stmt)
        active_state = result.scalar_one_or_none()

        if not active_state or "game_id" not in active_state.state_data:
            return

        game_id = active_state.state_data["game_id"]

        db_log = BattleLog(
            game_id=game_id,
            timestamp=datetime.datetime.fromisoformat(log_data["timestamp"].replace("Z", "+00:00")),
            player_name=log_data["player_name"],
            amount_changed=log_data["amount_changed"],
            new_score=log_data["new_score"],
        )
        db.add(db_log)
        await db.commit()

        # Broadcast the log action to others so they can see it in current battle log
        await sio.emit("action_logged", log_data, skip_sid=sid)

        # Trigger background task for AI Announcer if damage >= 10 OR if player is eliminated
        if HAS_BACKGROUND_TASKS and (
            log_data["amount_changed"] <= -10 or log_data["new_score"] <= 0
        ):
            try:
                await process_battle_event.kiq(log_data)
            except Exception as e:
                logger.error(f"Failed to queue background task: {e}")


@sio.event
async def request_status_report(sid):
    async with async_session_maker() as db:
        stmt = select(ActiveState)
        result = await db.execute(stmt)
        active_state = result.scalar_one_or_none()

        if not active_state or "game_id" not in active_state.state_data:
            return

        data = active_state.state_data

        scores_text = ", ".join(
            [
                f"{data['playerNames'][i]} has {data['authValues'][i]} authority"
                for i in range(data["players"])
            ]
        )

        if HAS_BACKGROUND_TASKS:
            try:
                await process_status_report.kiq(scores_text)
            except Exception as e:
                logger.error(f"Failed to queue background task: {e}")
