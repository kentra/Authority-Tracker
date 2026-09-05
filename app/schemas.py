from pydantic import BaseModel
from typing import List
import datetime


class PlayerStatBase(BaseModel):
    player_name: str
    score: int
    is_winner: bool


class PlayerStatCreate(PlayerStatBase):
    pass


class PlayerStatResponse(PlayerStatBase):
    id: int
    game_id: int

    class Config:
        from_attributes = True


class BattleLogBase(BaseModel):
    timestamp: datetime.datetime
    player_name: str
    amount_changed: int
    new_score: int


class BattleLogCreate(BattleLogBase):
    pass


class BattleLogResponse(BattleLogBase):
    id: int
    game_id: int

    class Config:
        from_attributes = True


class GameBase(BaseModel):
    player_count: int


class GameCreate(GameBase):
    players: List[PlayerStatCreate]
    logs: List[BattleLogCreate]


class GameResponse(GameBase):
    id: int
    date: datetime.datetime
    players: List[PlayerStatResponse]
    logs: List[BattleLogResponse]

    class Config:
        from_attributes = True
