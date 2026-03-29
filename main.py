from aiohttp.web import delete
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

import database
import models
import schemas
from google.genai import types

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


@sio.event
async def connect(sid, data):
    print(f"Client connected: {sid}")
    with database.SessionLocal() as db:
        active_state = db.query(models.ActiveState).first()
        # state = active_state.__dict__["state_data"]
        # state["users"]
        if not active_state or "game_id" not in active_state.state_data:
            print("No active game found, starting new game.")
            # start_game(sid, active_state.__dict__["state_data"])
            return
        
        # active_state.state_data
        print("Found active game, emitting state data")
        print(active_state.__dict__["state_data"])
        await sio.emit(event="state_updated", data=active_state.__dict__["state_data"], to=sid)

@sio.event
async def join_room(sid, data):
    room = data['room']
    await sio.enter_room(sid, room)
    print(f"User {data['user']} {sid} entered room: {room}")

    user_storage[data['user']] = sid
    await sio.emit('status', {"data": data, "user_storage": user_storage, "message":f"User {data['user']} entered room: {room}"}, to=sid)

@sio.event
async def leave_room(sid, data):
    room = data['room']
    await sio.leave_room(sid, room)
    print(f"User {data["user"]} left room: {room}, cleaning user storage")
    user_storage.pop(data["user"])

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
    print(f"State change received from {sid}")
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
# async def private_message(sid, data):
async def log_action(sid, log_data):
    # recipient_sid = data['recipient_sid']
    # message = data['message']
    print(log_data)
    # We send the message specifically to the recipient's private room
    # await sio.emit('new_private_msg', {
    #     'from': sid,
    #     'message': message
    # }, to=recipient_sid)
 

# @sio.event
# async def log_action(sid, log_data):
#     import datetime

#     with database.SessionLocal() as db:
#         active_state = db.query(models.ActiveState).first()
#         if not active_state or "game_id" not in active_state.state_data:
#             return

#         game_id = active_state.state_data["game_id"]

#         db_log = models.BattleLog(
#             game_id=game_id,
#             timestamp=datetime.datetime.fromisoformat(
#                 log_data["timestamp"].replace("Z", "+00:00")
#             ),
#             player_name=log_data["player_name"],
#             amount_changed=log_data["amount_changed"],
#             new_score=log_data["new_score"],
#         )
#         db.add(db_log)
#         db.commit()

#         # Broadcast the log action to others so they can see it in current battle log
#         # await sio.emit("action_logged", log_data, skip_sid=sid)

#         # Live Announcer logic
#         if gemini_client and tts_client:
#             # Trigger if damage >= 10 OR if player is eliminated
#             if log_data["amount_changed"] <= -10 or log_data["new_score"] <= 0:
#                 try:
#                     # event_context = f"A player named {log_data['player_name']} lost {abs(log_data['amount_changed'])} Authority, bringing his score to {log_data['new_score']}."
#                     event_context = f"A player named {log_data['player_name']} lost {abs(log_data['amount_changed'])} Authority."
#                     if log_data["new_score"] <= 0:
#                         event_context += " They have been eliminated!"

#                     prompt = f"You are a star fleet captain. Write a single, short sentence announcing current Authority change based on this context: {event_context} "

#                     response = gemini_client.models.generate_content(
#                         # model="gemini-2.5-flash",
#                         model="gemini-3.1-flash-lite-preview",
#                         contents=prompt,
#                         config=types.GenerateContentConfig(
#                                 thinking_config=types.ThinkingConfig(
#                                     # Options: 'MINIMAL', 'LOW', 'MEDIUM', 'HIGH'
#                                     thinking_level="MINIMAL"
#                                 )
#                             )
#                     )

#                     if response.text:
#                         generate_and_emit_audio(sid=sid, text=response.text)
#                         print("TTS: Sentence created and tts func triggered.")
#                 except Exception as e:
#                     print(f"Error generating Live Announcer: {e}")


def generate_and_emit_audio(sid: str, text: str):
    if not tts_client:
        return

    try:
        synthesis_input = texttospeech.SynthesisInput(text=text)
        voice = texttospeech.VoiceSelectionParams(
            # language_code="en-US",
            language_code="en-US",
            # name="en-US-Chirp3-HD-Sadaltager",  # Robotic/Sci-fi sounding voice
            name="en-US-Chirp3-HD-Algieba",  # Robotic/Sci-fi sounding voice
            # name="en-US-Journey-F",  # Robotic/Sci-fi sounding voice
        )
        audio_config = texttospeech.AudioConfig(
            audio_encoding=texttospeech.AudioEncoding.MP3,
            speaking_rate=1.2,
            # sample_rate_hertz=8000
            sample_rate_hertz=22050
            # pitch=-10
        )

        response = tts_client.synthesize_speech(
            input=synthesis_input, voice=voice, audio_config=audio_config
        )

        audio_base64 = base64.b64encode(response.audio_content).decode("utf-8")
        import asyncio
        import nest_asyncio

        nest_asyncio.apply()
        loop = asyncio.get_event_loop()
        loop.create_task(sio.emit("play_audio", {"audio": audio_base64},))
        print("Audio sent via websocket")
    except Exception as e:
        print(f"TTS Error: {e}")



@sio.event
async def request_status_report(sid):
    return
    if not gemini_client or not tts_client:
        return

    with database.SessionLocal() as db:
        active_state = db.query(models.ActiveState).first()
        if not active_state or "game_id" not in active_state.state_data:
            return

        data = active_state.state_data

        scores_text = ", ".join(
            [
                f"{data['playerNames'][i]} has {data['authValues'][i]} authority"
                for i in range(data["players"])
            ]
        )

        # prompt = f"You are a robotic Ship AI tracking a space battle. Give a dramatic 2-sentence status report. Current standings: {scores_text}."
        prompt = f"You are a narrator commenting on the current game. You will answer as if you were a character in the game Star Realms in a imersive way. Give a dramatic 2-sentence status report while slightly mocking the player with lowest Authority (not using the word pathetic) and praising the player with the highest Authority. You should also announce current standings based on this context: {scores_text}."

        try:
            # response = gemini_client.models.generate_content(
            #     model="gemini-2.5-flash",
            #     contents=prompt,
            # )
            response = gemini_client.models.generate_content(
                # model="gemini-2.5-flash",
                model="gemini-3.1-flash-lite-preview",
                contents=prompt,
                config=types.GenerateContentConfig(
                        thinking_config=types.ThinkingConfig(
                            # Options: 'MINIMAL', 'LOW', 'MEDIUM', 'HIGH'
                            thinking_level="MEDIUM" 
                        )
                    )
            )
            if response.text:
                generate_and_emit_audio(response.text)
        except Exception as e:
            print(f"Status Report Error: {e}")


socket_app = socketio.ASGIApp(sio, other_asgi_app=app)


def main():
    # Run the server on all interfaces so it's accessible from other devices on the network
    uvicorn.run("main:socket_app", host="0.0.0.0", port=8090, reload=True)


if __name__ == "__main__":
    main()
