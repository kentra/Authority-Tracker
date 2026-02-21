from fastapi import FastAPI, Depends
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, Integer
import uvicorn
import os
import socketio

import database
import models
import schemas

models.Base.metadata.create_all(bind=database.engine)

sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins="*")
app = FastAPI(title="Authority Tracker API")

# Setup paths to explicitly serve our frontend files
BASE_DIR = os.path.dirname(os.path.abspath(__file__))


@app.get("/")
async def serve_index():
    return FileResponse(os.path.join(BASE_DIR, "index.html"))


@app.get("/style.css")
async def serve_css():
    return FileResponse(os.path.join(BASE_DIR, "style.css"))


@app.get("/script.js")
async def serve_js():
    return FileResponse(os.path.join(BASE_DIR, "script.js"))


@app.get("/api/health")
async def health_check():
    return {"status": "ok", "message": "FastAPI is running"}


@app.post("/api/games", response_model=schemas.GameResponse)
async def save_game(game: schemas.GameCreate, db: Session = Depends(database.get_db)):
    db_game = models.Game(player_count=game.player_count)
    db.add(db_game)
    db.commit()
    db.refresh(db_game)

    for player in game.players:
        db_player = models.PlayerStat(
            game_id=db_game.id,
            player_name=player.player_name,
            score=player.score,
            is_winner=player.is_winner,
        )
        db.add(db_player)

    for log in game.logs:
        db_log = models.BattleLog(
            game_id=db_game.id,
            timestamp=log.timestamp,
            player_name=log.player_name,
            amount_changed=log.amount_changed,
            new_score=log.new_score,
        )
        db.add(db_log)

    db.commit()
    db.refresh(db_game)
    return db_game


@app.get("/api/games", response_model=list[schemas.GameResponse])
async def get_games(
    skip: int = 0, limit: int = 100, db: Session = Depends(database.get_db)
):
    games = (
        db.query(models.Game)
        .order_by(models.Game.date.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return games


@app.get("/api/state")
async def get_active_state(db: Session = Depends(database.get_db)):
    active_state = db.query(models.ActiveState).first()
    if active_state and active_state.state_data:
        return active_state.state_data
    return None


@app.get("/api/current_log")
async def get_current_log(db: Session = Depends(database.get_db)):
    active_state = db.query(models.ActiveState).first()
    if not active_state or "game_id" not in active_state.state_data:
        return []

    game_id = active_state.state_data["game_id"]
    logs = (
        db.query(models.BattleLog)
        .filter(models.BattleLog.game_id == game_id)
        .order_by(models.BattleLog.timestamp.desc())
        .all()
    )

    return [
        {
            "timestamp": log.timestamp.isoformat() + "Z",
            "player_name": log.player_name,
            "amount_changed": log.amount_changed,
            "new_score": log.new_score,
        }
        for log in logs
    ]


@app.get("/api/stats")
async def get_player_stats(db: Session = Depends(database.get_db)):
    # Calculate wins, losses, avg score for each player name
    stats = (
        db.query(
            models.PlayerStat.player_name,
            func.count(models.PlayerStat.id).label("games_played"),
            func.sum(func.cast(models.PlayerStat.is_winner, Integer)).label("wins"),
            func.avg(models.PlayerStat.score).label("avg_score"),
        )
        .group_by(models.PlayerStat.player_name)
        .all()
    )

    result = []
    for stat in stats:
        result.append(
            {
                "player_name": stat.player_name,
                "games_played": stat.games_played,
                "wins": stat.wins or 0,
                "losses": stat.games_played - (stat.wins or 0),
                "avg_score": round(stat.avg_score, 1) if stat.avg_score else 0,
            }
        )
    return result


@sio.event
async def connect(sid, environ):
    print(f"Client connected: {sid}")


@sio.event
async def disconnect(sid):
    print(f"Client disconnected: {sid}")


@sio.event
async def start_game(sid, data):
    with database.SessionLocal() as db:
        # Create new game
        db_game = models.Game(player_count=data["players"])
        db.add(db_game)
        db.commit()
        db.refresh(db_game)

        # Create PlayerStats
        for i in range(data["players"]):
            db_player = models.PlayerStat(
                game_id=db_game.id,
                player_name=data["playerNames"][i],
                score=data["authValues"][i],
                is_winner=False,
            )
            db.add(db_player)

        data["game_id"] = db_game.id

        active_state = db.query(models.ActiveState).first()
        if not active_state:
            active_state = models.ActiveState(state_data=data)
            db.add(active_state)
        else:
            active_state.state_data = data
        db.commit()

    await sio.emit("state_updated", data)


@sio.event
async def state_change(sid, data):
    with database.SessionLocal() as db:
        active_state = db.query(models.ActiveState).first()
        if not active_state:
            active_state = models.ActiveState(state_data=data)
            db.add(active_state)
        else:
            # Preserve game_id if not present in incoming data
            if "game_id" not in data and "game_id" in active_state.state_data:
                data["game_id"] = active_state.state_data["game_id"]
            active_state.state_data = data

        # Update PlayerStats continuously
        game_id = data.get("game_id")
        if game_id:
            db_players = (
                db.query(models.PlayerStat)
                .filter(models.PlayerStat.game_id == game_id)
                .all()
            )
            if db_players:
                max_score = max(data["authValues"]) if data["authValues"] else 0
                # Assuming order of db_players matches order of names/scores (created in order)
                # To be safe, match by index, but we don't have index in DB. Match by id order?
                db_players.sort(key=lambda x: x.id)
                for i, db_player in enumerate(db_players):
                    if i < len(data["authValues"]):
                        db_player.score = data["authValues"][i]
                        db_player.player_name = data["playerNames"][i]
                        db_player.is_winner = data["authValues"][i] == max_score

        db.commit()

    await sio.emit("state_updated", data, skip_sid=sid)


@sio.event
async def log_action(sid, log_data):
    import datetime

    with database.SessionLocal() as db:
        active_state = db.query(models.ActiveState).first()
        if not active_state or "game_id" not in active_state.state_data:
            return

        game_id = active_state.state_data["game_id"]

        db_log = models.BattleLog(
            game_id=game_id,
            timestamp=datetime.datetime.fromisoformat(
                log_data["timestamp"].replace("Z", "+00:00")
            ),
            player_name=log_data["player_name"],
            amount_changed=log_data["amount_changed"],
            new_score=log_data["new_score"],
        )
        db.add(db_log)
        db.commit()

        # Broadcast the log action to others so they can see it in current battle log
        await sio.emit("action_logged", log_data, skip_sid=sid)


socket_app = socketio.ASGIApp(sio, other_asgi_app=app)


def main():
    # Run the server on all interfaces so it's accessible from other devices on the network
    uvicorn.run("main:socket_app", host="0.0.0.0", port=8000, reload=True)


if __name__ == "__main__":
    main()
