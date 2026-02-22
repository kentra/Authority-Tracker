import datetime

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Game(Base):
    __tablename__ = "games"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    date: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow)
    player_count: Mapped[int] = mapped_column(Integer)

    players: Mapped[list["PlayerStat"]] = relationship(
        "PlayerStat", back_populates="game", cascade="all, delete"
    )
    logs: Mapped[list["BattleLog"]] = relationship(
        "BattleLog", back_populates="game", cascade="all, delete"
    )


class BattleLog(Base):
    __tablename__ = "battle_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    game_id: Mapped[int] = mapped_column(Integer, ForeignKey("games.id"))
    timestamp: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow)
    player_name: Mapped[str] = mapped_column(String, index=True)
    amount_changed: Mapped[int] = mapped_column(Integer)
    new_score: Mapped[int] = mapped_column(Integer)

    game: Mapped["Game"] = relationship("Game", back_populates="logs")


class PlayerStat(Base):
    __tablename__ = "player_stats"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    game_id: Mapped[int] = mapped_column(Integer, ForeignKey("games.id"))
    player_name: Mapped[str] = mapped_column(String, index=True)
    score: Mapped[int] = mapped_column(Integer)
    is_winner: Mapped[bool] = mapped_column(Boolean, default=False)

    game: Mapped["Game"] = relationship("Game", back_populates="players")


class ActiveState(Base):
    __tablename__ = "active_state"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    state_data: Mapped[dict] = mapped_column(JSON)
