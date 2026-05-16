"""
Pydantic schemas for Tic Tac Toe game APIs.
"""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


Difficulty = Literal["easy", "balanced", "hard"]
Personality = Literal["strategic", "aggressive", "playful"]


class StartGameRequest(BaseModel):
    difficulty: Difficulty = "balanced"
    personality: Personality = "aggressive"


class MoveRequest(BaseModel):
    row: int = Field(ge=0, le=2)
    col: int = Field(ge=0, le=2)
    explain: bool = True


class RestartGameRequest(BaseModel):
    reset_score: bool = False
    difficulty: Difficulty | None = None
    personality: Personality | None = None
