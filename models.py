
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, JSON
from sqlalchemy.orm import relationship
import datetime
from pydantic import BaseModel
from typing import Optional
from database import Base
from typing import Union
# import datetime

class Game(Base):
    __tablename__ = "games"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(DateTime, default=datetime.datetime.now(tz=datetime.timezone.utc))
    player_count = Column(Integer)

    players = relationship("PlayerStat", back_populates="game", cascade="all, delete")
    logs = relationship("BattleLog", back_populates="game", cascade="all, delete")


class BattleLog(Base):
    __tablename__ = "battle_logs"

    id = Column(Integer, primary_key=True, index=True)
    game_id = Column(Integer, ForeignKey("games.id"))
    # timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    timestamp = Column(DateTime, default=datetime.datetime.now(tz=datetime.timezone.utc))
    player_name = Column(String, index=True)
    amount_changed = Column(Integer)
    new_score = Column(Integer)

    game = relationship("Game", back_populates="logs")


class PlayerStat(Base):
    __tablename__ = "player_stats"

    id = Column(Integer, primary_key=True, index=True)
    game_id = Column(Integer, ForeignKey("games.id"))
    player_name = Column(String, index=True)
    score = Column(Integer)
    is_winner = Column(Boolean, default=False)

    game = relationship("Game", back_populates="players")


class ActiveState(Base):
    __tablename__ = "active_state"

    id = Column(Integer, primary_key=True, index=True)
    state_data = Column(JSON)



# ------ Pydantic ------ #

class LogData(BaseModel):
    timestamp: Optional[Union[datetime.datetime, None]] = None
    player_name: Optional[Union[str, None]] = None
    amount_changed: Optional[Union[int, None]] = None
    new_score: Optional[Union[int, None]] = None
    # recipient_sid: Optional[Union[str, None]] = None

class State(BaseModel):
    game_id: Optional[Union[int, None]] = None
    players: Optional[Union[int, None]] = None
    startingAuth: Optional[Union[int, None]] = None
    authValues: Optional[Union[list, None]] = None
    playerNames: Optional[Union[list, None]] = None
    rotations: Optional[Union[list, None]] = None
    battleLog: Optional[Union[list|None]] = None
    users: Optional[Union[list|None]] = None

class Data(BaseModel):
    timestamp: str
    message: Optional[Union[str, None]] = None
    log_data: Optional[Union[LogData, None]] = None
    state: Optional[Union[State, None]] = None
    request: Optional[Union[str, None]] = None

class Broadcast(BaseModel):
    sid: str
    data: Optional[Data]
