import datetime

from sqlalchemy import JSON, Boolean, Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from .database import Base


class Game(Base):
    __tablename__ = "games"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(DateTime, default=datetime.datetime.now(tz=datetime.UTC))
    player_count = Column(Integer)

    players = relationship("PlayerStat", back_populates="game", cascade="all, delete")
    logs = relationship("BattleLog", back_populates="game", cascade="all, delete")


class BattleLog(Base):
    __tablename__ = "battle_logs"

    id = Column(Integer, primary_key=True, index=True)
    game_id = Column(Integer, ForeignKey("games.id"))
    # timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    timestamp = Column(DateTime, default=datetime.datetime.now(tz=datetime.UTC))
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
