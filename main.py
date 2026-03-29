from asyncio.events import AbstractEventLoop
from google.cloud.texttospeech_v1.types.cloud_tts import SynthesizeSpeechResponse
from fastapi import FastAPI, Depends
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, Integer
import uvicorn
import os
import socketio
import base64
from fastapi.staticfiles import StaticFiles
from google import genai
from google.cloud import texttospeech
from dotenv import load_dotenv
from loguru import logger
import database
import models
import schemas
from google.genai import types
# from models import Broadcast


load_dotenv()

# Initialize API clients
gemini_client = None
if os.getenv("GEMINI_API_KEY"):
    gemini_client = genai.Client()

tts_client = None

# Simple in-memory mapping
user_storage = {} 

if os.getenv("GOOGLE_APPLICATION_CREDENTIALS"):
    tts_client = texttospeech.TextToSpeechClient()

models.Base.metadata.create_all(bind=database.engine)

sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins="*")
app = FastAPI(title="Authority Tracker API")
# Mount the "static" directory to the "/static" path

app.mount("/media", StaticFiles(directory="media"), name="media")

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


# def normalize_incoming_socket_data(data: dict) -> dict:
#     """Normalize incoming socket broadcast payloads to avoid nested wrapper in state."""
#     if not isinstance(data, dict):
#         return data

#     raw_state = data.get("state")
#     if isinstance(raw_state, dict) and "state" in raw_state and isinstance(raw_state["state"], dict):
#         data["state"] = raw_state["state"]
#     return data


@sio.event
async def connect(sid, data):
    logger.debug(f"Client connected: {sid}")
    with database.SessionLocal() as db:
        active_state = db.query(models.ActiveState).first()

        if not active_state:
            logger.debug("No active state record found in DB for new connection.")
            return

        if not active_state.state_data:
            logger.debug("Active state record exists but has no state_data.")


        logger.debug(f"Active state from DB: {active_state.state_data}")

        if "game_id" not in active_state.state_data:
            logger.debug("No active game found in state_data, starting new game.")


        logger.debug(f"Found active game, emitting state data to {sid}")
        await sio.emit(event="state_updated", data=active_state.state_data)

@sio.event
async def join_room(sid, data):
    room = data['room']
    await sio.enter_room(sid, room)
    # print(f"User {data['user']} {sid} entered room: {room}")
    user_storage[data['user']] = sid
    await sio.emit('status', {}, to=sid)
    await sio.emit('share_state', {}, to=sid)
    await sio.emit('state_updated', {}, to=sid)
    await sio.emit('play_audio', {}, to=sid)
    await sio.emit('action_logged', {}, to=sid)
    await sio.emit('state_updated', {}, to=sid)

@sio.event
async def leave_room(sid, data):
    room = data['room']
    await sio.leave_room(sid, room)
    # print(f"User {data["user"]} left room: {room}, cleaning user storage")
    user_storage.pop(data["user"])


@sio.event
async def broadcast(sid: str, data: dict):
    # normalized = normalize_incoming_socket_data(data)
    try:
        parsed_data = models.Data(**data)
    except Exception as e:
        logger.error(f"Failed to parse broadcast payload from {sid}: {e}")
        return

    logger.debug(f"Broadcast received from {sid} with request type: {parsed_data.request}")
    # if parsed_data.request == "request_ai_status_report":
    #     await request_ai_status_report(sid=sid, data=parsed_data)
    if parsed_data.request == "log_data" and parsed_data.log_data:
        await log_action(sid=sid, data=parsed_data)
    elif parsed_data.request == "state_change" and parsed_data.state:
        await state_change(sid=sid, data=parsed_data)
    elif parsed_data.request == "start_game" and parsed_data.state:
        await start_game(sid=sid, data=parsed_data)
    elif parsed_data.request == "share_state":
        with database.SessionLocal() as db:
            active_state = db.query(models.ActiveState).first()
            if active_state and active_state.state_data:
                active_state_data = active_state.state_data

            logger.debug(f"Sharing state from {sid}: {active_state_data}")
            # await sio.emit("state_updated", active_state_data) 
            # await sio.emit("state_updated", active_state_data, to="general") 
            # await sio.emit('status', {"data": active_state_data, "user_storage": user_storage, "message":"User entered room: status"}, to="tts")
            # await sio.emit('join_room', {"data": active_state_data, "user_storage": user_storage, "message":"Use entered room: join_room"}, to="general")

            
            # await sio.emit("state_updated", active_state_data, skip_sid=sid) 

        # if active_state_data:
            # await sio.emit("state_updated", active_state_data, skip_sid=sid) 
            await sio.emit("state_updated", active_state_data, skip_sid=sid) 
    else:
        print(f"Unknown request type: {parsed_data.request}")
        pass


@sio.event
async def start_game(sid, data: models.Data):
    logger.debug(f"Start game request received from {sid}")
    if not data or not data.state:
        logger.warning(f"start_game received without state payload from {sid}")
        return

    players = (
        data.state.players
        if isinstance(data.state.players, int) and data.state.players > 0
        else min(
            len(data.state.playerNames or []),
            len(data.state.authValues or []),
        )
    )

    if players <= 0:
        logger.warning(f"start_game received invalid player count from {sid}: {data.state.players}")


    with database.SessionLocal() as db:
        # Create new game
        db_game = models.Game(player_count=players)
        db.add(db_game)
        db.commit()
        db.refresh(db_game)

        # Create PlayerStats
        for i in range(players):
            player_name = (data.state.playerNames or [])[i] if i < len(data.state.playerNames or []) else f"Player {i+1}"
            auth_value = (data.state.authValues or [])[i] if i < len(data.state.authValues or []) else 0
            db_player = models.PlayerStat(
                game_id=db_game.id,
                player_name=player_name,
                score=auth_value,
                is_winner=False,
            )
            db.add(db_player)

        data.state.game_id = db_game.id

        active_state = db.query(models.ActiveState).first()
        if not active_state:
            active_state = models.ActiveState(state_data=data.state.model_dump())
            db.add(active_state)
        else:
            active_state.state_data = data.state.model_dump()
        db.commit()

    await sio.emit("state_updated", data.state.model_dump())


@sio.event
async def state_change(sid, data: models.Data):
    # print(f"State change received from {sid}")
    logger.debug(f"State change received from {sid}")
    if not data or not data.state:
        logger.warning(f"state_change received without valid state from {sid}")
        return

    with database.SessionLocal() as db:
        active_state = db.query(models.ActiveState).first()
        if not active_state:
            active_state = models.ActiveState(state_data=data.state.model_dump())
            db.add(active_state)
        else:
            # Preserve game_id if not present in incoming data
            if not data.state.game_id and active_state.state_data.get("game_id"):
                data.state.game_id = active_state.state_data["game_id"]
            active_state.state_data = data.state.model_dump()

        # Update PlayerStats continuously
        game_id = data.state.game_id
        if game_id:
            db_players = (
                db.query(models.PlayerStat)
                .filter(models.PlayerStat.game_id == game_id)
                .all()
            )
            if db_players:
                max_score = max(data.state.authValues) if data.state.authValues else 0
                # Assuming order of db_players matches order of names/scores (created in order)
                # To be safe, match by index, but we don't have index in DB. Match by id order?
                db_players.sort(key=lambda x: x.id)
                for i, db_player in enumerate(db_players):
                    if i < len(data.state.authValues):
                        db_player.score = data.state.authValues[i]
                        db_player.player_name = data.state.playerNames[i]
                        db_player.is_winner = data.state.authValues[i] == max_score

        db.commit()

    # await sio.emit("state_updated", data.state.model_dump(), skip_sid=sid)
    await sio.emit("state_updated", data.state.model_dump())

@sio.event
async def log_action(sid: str, data: models.Data):
    if not hasattr(data, "log_data") or data.log_data is None:
        logger.warning(f"Received log action without log_data from {sid}")
        return

    with database.SessionLocal() as db:
        active_state = db.query(models.ActiveState).first()
        if not active_state or "game_id" not in active_state.state_data:
            logger.warning(f"No active game found when trying to log action from {sid}")
            return

        game_id = active_state.state_data["game_id"]
        db_log = models.BattleLog(
            game_id=game_id,
            timestamp=data.timestamp,
            player_name=data.log_data.player_name,
            amount_changed=data.log_data.amount_changed,
            new_score=data.log_data.new_score,
        )
        db.add(db_log)
        db.commit()

        # Broadcast the log action to others so they can see it in current battle log
        await sio.emit("action_logged", data.log_data.model_dump_json(), skip_sid=sid)
        # await sio.emit(event="battlelog", data=data.log_data.model_dump_json(), skip_sid=sid, to="general")

        # # Live Announcer logic
        # if gemini_client and tts_client:
        #     # Trigger if damage >= 10 OR if player is eliminated
        #     if data.log_data.amount_changed <= -10 or data.log_data.new_score <= 0:
        #         try:
        #             event_context = f"A player named {data.log_data.player_name} lost {abs(data.log_data.amount_changed)} Authority."
        #             if data.log_data.new_score <= 0:
        #                 event_context += " They have been eliminated!"
        #             prompt = f"You are a star fleet captain. Write a single, short sentence announcing current Authority change based on this context: {event_context} "

        #             response = gemini_client.models.generate_content(
        #                 model="gemini-3.1-flash-lite-preview",
        #                 contents=prompt,
        #                 config=types.GenerateContentConfig(
        #                         thinking_config=types.ThinkingConfig(
        #                             # Options: 'MINIMAL', 'LOW', 'MEDIUM', 'HIGH'
        #                             thinking_level="MINIMAL"  # ty:ignore[invalid-argument-type]
        #                         )
        #                     )
        #             )

        #             if response.text:
        #                 await generate_and_emit_audio(sid=sid, text=response.text)
        #                 # print("TTS: Sentence created and tts func triggered.")
        #         except Exception as e:
        #             print(f"Error generating Live Announcer: {e}")


# async def generate_and_emit_audio(sid: str, text: str):
#     if not tts_client:
#         return

#     try:
#         synthesis_input = texttospeech.SynthesisInput(text=text)
#         voice = texttospeech.VoiceSelectionParams(
#             language_code="en-US",
#             name="en-US-Chirp3-HD-Algieba",
#         )
#         audio_config = texttospeech.AudioConfig(
#             audio_encoding=texttospeech.AudioEncoding.MP3,
#             speaking_rate=1.2,
#             sample_rate_hertz=22050
#         )

#         response: SynthesizeSpeechResponse = tts_client.synthesize_speech(
#             input=synthesis_input, voice=voice, audio_config=audio_config
#         )

#         audio_base64: str = base64.b64encode(response.audio_content).decode("utf-8")
#         import asyncio
#         import nest_asyncio

#         await nest_asyncio.apply()
#         loop: AbstractEventLoop = asyncio.get_event_loop()
#         # loop.create_task(sio.emit("play_audio", {"audio": audio_base64},))
#         await loop.create_task(coro=sio.emit(event="play_audio", data={"audio": audio_base64, "message":"Done making voice sample."}, to="tts"))
#         # print("Audio sent via websocket")
#     except Exception:
#         pass




# async def request_ai_status_report(sid: str, data: models.Data):

#     if not gemini_client or not tts_client:
#         return

#     with database.SessionLocal() as db:
#         active_state: models.ActiveState | None = db.query(models.ActiveState).first()
#         if not active_state or "game_id" not in active_state.state_data:
#             logger.warning(f"No active game found when trying to generate status report for {sid}")
#             return

#         state: models.State | None = data.state
#         logger.debug(state)
#         if not state or not state.playerNames or not state.authValues:
#             logger.warning(f"Incomplete state data received for status report from {sid}")
#             return

#         players_count: int = (
#             state.players
#             if isinstance(state.players, int) and state.players > 0
#             else min(len(state.playerNames), len(state.authValues))
#         )
#         logger.debug(f"Generating status report for {sid} with player count: {players_count}")
#         scores_text: str = ", ".join(
#             [
#                 f"{state.playerNames[i]} has {state.authValues[i]} authority"
#                 for i in range(min(players_count, len(state.playerNames), len(state.authValues)))
#             ]
#         )
#         prompt = f"You are a narrator commenting on the current game. You will answer as if you were a character in the game Star Realms in a imersive way. Give a dramatic 2-sentence status report while slightly mocking the player with lowest Authority (not using the word pathetic) and praising the player with the highest Authority. You should also announce current standings based on this context: {scores_text}."
#         logger.debug(f"Status report prompt for {sid}: {prompt}")

#         try:
#             response = gemini_client.models.generate_content(
#                 model="gemini-3.1-flash-lite-preview",
#                 contents=prompt,
#                 config=types.GenerateContentConfig(
#                         thinking_config=types.ThinkingConfig(
#                             # Options: 'MINIMAL', 'LOW', 'MEDIUM', 'HIGH'
#                             thinking_level="MEDIUM"  # ty:ignore[invalid-argument-type]
#                         )
#                     )
#             )
#             logger.debug(f"Status report response for {sid}: {response.text}")
#             if response.text:
#                 await generate_and_emit_audio(sid=sid, text=response.text)
#         except Exception as e:
#             logger.error(f"Status Report Error for {sid}: {e}")
#             logger.debug(f"Status report prompt that caused error for {sid}: {prompt}")


socket_app = socketio.ASGIApp(sio, other_asgi_app=app)


def main():
    # Run the server on all interfaces so it's accessible from other devices on the network
    uvicorn.run("main:socket_app", host="0.0.0.0", port=8090, reload=True)


if __name__ == "__main__":
    main()
