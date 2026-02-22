import base64
import logging
import os
from typing import Any

from google import genai
from google.cloud import texttospeech

from app.core.config import settings
from app.worker.taskiq_app import broker

logger = logging.getLogger(__name__)

# Initialize API clients
gemini_client = None
if settings.GEMINI_API_KEY:
    gemini_client = genai.Client(api_key=settings.GEMINI_API_KEY)

tts_client = None
try:
    if os.getenv("GOOGLE_APPLICATION_CREDENTIALS"):
        tts_client = texttospeech.TextToSpeechClient()
except Exception as e:
    logger.warning(f"Could not initialize TextToSpeechClient: {e}")


async def generate_and_emit_audio(text: str):
    if not tts_client:
        logger.warning("TTS client not initialized. Skipping audio generation.")
        return

    try:
        synthesis_input = texttospeech.SynthesisInput(text=text)
        voice = texttospeech.VoiceSelectionParams(
            language_code="en-US",
            name="en-US-Chirp3-HD-Sadaltager",  # Robotic/Sci-fi sounding voice
        )
        audio_config = texttospeech.AudioConfig(audio_encoding=texttospeech.AudioEncoding.MP3)

        response = tts_client.synthesize_speech(
            input=synthesis_input, voice=voice, audio_config=audio_config
        )

        audio_base64 = base64.b64encode(response.audio_content).decode("utf-8")

        # We need to emit via socket.io. Since this is a separate process in Taskiq,
        # we ideally need to use a redis message queue or similar to broadcast, but
        # python-socketio supports message queues for this exact reason.
        import socketio

        # Connect to the Redis message queue configured for socketio
        mgr = socketio.AsyncRedisManager(
            f"redis://{settings.REDIS_HOST}:{settings.REDIS_PORT}/{settings.REDIS_DB}"
        )

        # Emit the event using the manager
        await mgr.emit("play_audio", {"audio": audio_base64})

    except Exception as e:
        logger.error(f"TTS Error: {e}")


@broker.task
async def process_battle_event(log_data: dict[str, Any]):
    """Process a battle event and generate audio announcement."""
    if not gemini_client or not tts_client:
        logger.warning("AI clients not configured. Skipping process_battle_event.")
        return

    try:
        event_context = f"A player named {log_data['player_name']} just took {abs(log_data['amount_changed'])} damage, bringing their score to {log_data['new_score']}."
        if log_data["new_score"] <= 0:
            event_context += " They have been eliminated!"

        prompt = f"You are a foul and spiteful Ship AI tracking and commenting a space battle. {event_context} Write a single, short, urgent warning sentence announcing this."

        response = gemini_client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
        )

        if response.text:
            await generate_and_emit_audio(response.text)
    except Exception as e:
        logger.error(f"Error generating Live Announcer: {e}")


@broker.task
async def process_status_report(scores_text: str):
    """Process a status report request and generate audio announcement."""
    if not gemini_client or not tts_client:
        logger.warning("AI clients not configured. Skipping process_status_report.")
        return

    prompt = f"You are a robotic Ship AI tracking a space battle. Give a dramatic 2-sentence status report. Current standings: {scores_text}."

    try:
        response = gemini_client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
        )

        if response.text:
            await generate_and_emit_audio(response.text)
    except Exception as e:
        logger.error(f"Status Report Error: {e}")
