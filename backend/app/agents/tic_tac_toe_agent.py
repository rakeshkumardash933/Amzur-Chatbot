"""
LLM-orchestrated Tic Tac Toe agent.
"""
from __future__ import annotations

from typing import Any

from app.mcp.mcp_client import get_mcp_client
from app.services.game_service import Board, detect_winner, strategic_fallback_move


def _winning_move(board: Board, symbol: str, legal: list[tuple[int, int]]) -> tuple[int, int] | None:
    for r, c in legal:
        test = [row[:] for row in board]
        test[r][c] = symbol
        if detect_winner(test) == symbol:
            return r, c
    return None


def _fork_moves(board: Board, symbol: str, legal: list[tuple[int, int]]) -> list[tuple[int, int]]:
    forks: list[tuple[int, int]] = []
    for r, c in legal:
        test = [row[:] for row in board]
        test[r][c] = symbol
        future_legal = [(rr, cc) for rr in range(3) for cc in range(3) if test[rr][cc] == ""]
        wins = 0
        for rr, cc in future_legal:
            next_board = [row[:] for row in test]
            next_board[rr][cc] = symbol
            if detect_winner(next_board) == symbol:
                wins += 1
        if wins >= 2:
            forks.append((r, c))
    return forks


def _prefer_aggressive(
    board: Board,
    ai_symbol: str,
    user_symbol: str,
    legal: list[tuple[int, int]],
) -> tuple[int, int, str] | None:
    # 1) Win immediately.
    win = _winning_move(board, ai_symbol, legal)
    if win:
        return win[0], win[1], "Aggressive finish: taking immediate winning move"

    # 2) Prevent immediate loss.
    block = _winning_move(board, user_symbol, legal)
    if block:
        return block[0], block[1], "Aggressive defense: blocking opponent winning move"

    # 3) Create fork.
    ai_forks = _fork_moves(board, ai_symbol, legal)
    if ai_forks:
        r, c = ai_forks[0]
        return r, c, "Aggressive pressure: creating a fork"

    # 4) Block opponent fork.
    user_forks = _fork_moves(board, user_symbol, legal)
    if user_forks:
        r, c = user_forks[0]
        return r, c, "Blocking opponent fork opportunity"

    # 5) Positional pressure.
    for cand in [(1, 1), (0, 0), (0, 2), (2, 0), (2, 2), (0, 1), (1, 0), (1, 2), (2, 1)]:
        if cand in legal:
            return cand[0], cand[1], "Applying aggressive positional pressure"

    return None


async def choose_ai_move(
    board: Board,
    ai_symbol: str,
    user_symbol: str,
    available_moves: list[tuple[int, int]],
    difficulty: str,
    personality: str,
    move_history: list[dict[str, Any]],
) -> dict[str, Any]:
    """
    Resolve an AI move with LLM-first strategy and deterministic fallback.
    """
    last_error = ""

    # Tactical priority for hard/aggressive mode to avoid weak play.
    forced = None
    if difficulty == "hard" or personality == "aggressive":
        forced = _prefer_aggressive(board, ai_symbol, user_symbol, available_moves)

    for _ in range(3):
        try:
            client = get_mcp_client()
            await client.discover_tools()
            payload = await client.call_tool(
                "game.suggest_move",
                {
                    "board": board,
                    "ai_symbol": ai_symbol,
                    "user_symbol": user_symbol,
                    "available_moves": [{"row": r, "col": c} for r, c in available_moves],
                    "difficulty": difficulty,
                    "personality": personality,
                    "move_history": move_history,
                },
            )
            decision = (payload.get("result") or {}).get("move") or {}

            row = int(decision.get("row"))
            col = int(decision.get("col"))
            if (row, col) not in available_moves:
                last_error = f"LLM suggested invalid cell ({row}, {col})"
                continue

            # If a critical tactical move exists, enforce it to keep AI strong.
            if forced and (row, col) != (forced[0], forced[1]):
                return {
                    "row": forced[0],
                    "col": forced[1],
                    "reason": forced[2],
                    "confidence": 0.95,
                    "source": "llm",
                }

            confidence = decision.get("confidence", 0.75)
            try:
                confidence = float(confidence)
            except Exception:
                confidence = 0.75

            reason = str(decision.get("reason") or "Strategic board control")
            return {
                "row": row,
                "col": col,
                "reason": reason,
                "confidence": max(0.0, min(1.0, confidence)),
                "source": "llm",
            }
        except Exception as exc:
            last_error = str(exc)

    if forced:
        return {
            "row": forced[0],
            "col": forced[1],
            "reason": f"{forced[2]}. Used tactical enforcement after LLM retries.",
            "confidence": 0.92,
            "source": "fallback",
            "llm_error": last_error,
        }

    r, c, fallback_reason = strategic_fallback_move(board, ai_symbol=ai_symbol, user_symbol=user_symbol)
    return {
        "row": r,
        "col": c,
        "reason": f"{fallback_reason}. Fallback used because LLM output was invalid/unavailable.",
        "confidence": 0.55,
        "source": "fallback",
        "llm_error": last_error,
    }
