"""
LiteLLM-backed move suggestion service for Tic Tac Toe.
"""
from __future__ import annotations

import asyncio
import json
import re
from typing import Any

from openai import AsyncOpenAI

from app.core.config import settings
from app.services.game_service import Board


def _get_client() -> AsyncOpenAI:
    key = settings.LITELLM_VIRTUAL_KEY or settings.LITELLM_API_KEY
    return AsyncOpenAI(api_key=key, base_url=settings.LITELLM_PROXY_URL)


def _extract_json(text: str) -> dict[str, Any]:
    text = (text or "").strip()
    if not text:
        raise ValueError("Empty LLM response")

    # Best effort: direct parse first.
    try:
        parsed = json.loads(text)
        if isinstance(parsed, dict):
            return parsed
    except Exception:
        pass

    # Fallback: find first JSON object in free text.
    match = re.search(r"\{[\s\S]*\}", text)
    if not match:
        raise ValueError("LLM response did not contain JSON")
    parsed = json.loads(match.group(0))
    if not isinstance(parsed, dict):
        raise ValueError("Expected JSON object")
    return parsed


def _board_text(board: Board) -> str:
    return "\n".join([" | ".join([cell or "_" for cell in row]) for row in board])


async def suggest_move(
    board: Board,
    ai_symbol: str,
    user_symbol: str,
    available: list[tuple[int, int]],
    difficulty: str,
    personality: str,
    move_history: list[dict[str, Any]],
) -> dict[str, Any]:
    """
    Ask the LLM for the next move in strict JSON format.
    Returns parsed dict; caller must validate row/col legality.
    """
    style_directive = {
        "strategic": "Play balanced and robust. Prefer reliable control and avoid risky traps.",
        "aggressive": "Play aggressively. Prioritize forcing lines, forks, corner pressure, and fast wins.",
        "playful": "Play creative but still valid. Keep tactical awareness and avoid obvious blunders.",
    }.get(personality, "Play balanced and robust.")

    system_prompt = (
        "You are an intelligent Tic Tac Toe AI agent. "
        "Analyze the board strategically and return ONLY JSON with keys: row, col, reason, confidence. "
        "Rules in strict priority: (1) immediate win, (2) block opponent immediate win, "
        "(3) create fork opportunities, (4) block opponent forks, (5) maximize positional advantage. "
        "Always choose only from provided available_moves. Never output markdown. "
        f"Personality instruction: {style_directive}"
    )

    user_prompt = {
        "board": board,
        "board_visual": _board_text(board),
        "you_are": ai_symbol,
        "opponent_is": user_symbol,
        "available_moves": [{"row": r, "col": c} for r, c in available],
        "difficulty": difficulty,
        "personality": personality,
        "recent_moves": move_history[-6:],
        "required_output_example": {
            "row": 1,
            "col": 2,
            "reason": "Blocking opponent winning move",
            "confidence": 0.91,
        },
    }

    client = _get_client()
    response = await asyncio.wait_for(
        client.chat.completions.create(
            model=settings.LLM_MODEL,
            temperature=0.0 if (difficulty == "hard" or personality == "aggressive") else (0.2 if difficulty != "easy" else 0.5),
            max_tokens=140,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": json.dumps(user_prompt)},
            ],
        ),
        timeout=20,
    )

    content = response.choices[0].message.content or ""
    return _extract_json(content)
