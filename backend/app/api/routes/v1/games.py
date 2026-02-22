from fastapi import APIRouter, Depends
from sqlalchemy import Integer, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.db.models.game import ActiveState, BattleLog, Game, PlayerStat
from app.schemas.game import GameCreate, GameResponse

router = APIRouter()


@router.post("/games", response_model=GameResponse)
async def save_game(game: GameCreate, db: AsyncSession = Depends(get_db)):
    db_game = Game(player_count=game.player_count)
    db.add(db_game)
    await db.commit()
    await db.refresh(db_game)

    for player in game.players:
        db_player = PlayerStat(
            game_id=db_game.id,
            player_name=player.player_name,
            score=player.score,
            is_winner=player.is_winner,
        )
        db.add(db_player)

    for log in game.logs:
        db_log = BattleLog(
            game_id=db_game.id,
            timestamp=log.timestamp,
            player_name=log.player_name,
            amount_changed=log.amount_changed,
            new_score=log.new_score,
        )
        db.add(db_log)

    await db.commit()
    await db.refresh(db_game)

    # Pre-load relationships for response model
    stmt = select(Game).where(Game.id == db_game.id)
    result = await db.execute(stmt)
    return result.scalar_one()


@router.get("/games", response_model=list[GameResponse])
async def get_games(skip: int = 0, limit: int = 100, db: AsyncSession = Depends(get_db)):
    stmt = select(Game).order_by(Game.date.desc()).offset(skip).limit(limit)
    result = await db.execute(stmt)
    games = result.scalars().all()

    # A bit of eager loading may be needed depending on sqlalchemy config,
    # but let's stick to the simplest translation first
    return games


@router.get("/state")
async def get_active_state(db: AsyncSession = Depends(get_db)):
    stmt = select(ActiveState)
    result = await db.execute(stmt)
    active_state = result.scalar_one_or_none()

    if active_state and active_state.state_data:
        return active_state.state_data
    return None


@router.get("/current_log")
async def get_current_log(db: AsyncSession = Depends(get_db)):
    stmt = select(ActiveState)
    result = await db.execute(stmt)
    active_state = result.scalar_one_or_none()

    if not active_state or "game_id" not in active_state.state_data:
        return []

    game_id = active_state.state_data["game_id"]

    log_stmt = (
        select(BattleLog).where(BattleLog.game_id == game_id).order_by(BattleLog.timestamp.desc())
    )
    log_result = await db.execute(log_stmt)
    logs = log_result.scalars().all()

    return [
        {
            "timestamp": log.timestamp.isoformat() + "Z",
            "player_name": log.player_name,
            "amount_changed": log.amount_changed,
            "new_score": log.new_score,
        }
        for log in logs
    ]


@router.get("/stats")
async def get_player_stats(db: AsyncSession = Depends(get_db)):
    # Calculate wins, losses, avg score for each player name
    stmt = select(
        PlayerStat.player_name,
        func.count(PlayerStat.id).label("games_played"),
        func.sum(func.cast(PlayerStat.is_winner, Integer)).label("wins"),
        func.avg(PlayerStat.score).label("avg_score"),
    ).group_by(PlayerStat.player_name)
    result = await db.execute(stmt)
    stats = result.all()

    response = []
    for stat in stats:
        response.append(
            {
                "player_name": stat.player_name,
                "games_played": stat.games_played,
                "wins": stat.wins or 0,
                "losses": stat.games_played - (stat.wins or 0),
                "avg_score": round(stat.avg_score, 1) if stat.avg_score else 0,
            }
        )
    return response
