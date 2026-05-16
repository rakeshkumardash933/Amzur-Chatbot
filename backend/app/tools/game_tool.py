"""MCP tool wrapper for Tic Tac Toe move generation."""
from __future__ import annotations

from typing import Any

from app.mcp.tool_registry import MCPTool, MCPToolRegistry
from app.services.llm_game_service import suggest_move


async def _suggest_game_move(args: dict[str, Any]) -> dict[str, Any]:
    board = args.get("board")
    ai_symbol = str(args.get("ai_symbol", "O"))
    user_symbol = str(args.get("user_symbol", "X"))
    available_raw = args.get("available_moves") or []
    difficulty = str(args.get("difficulty", "balanced"))
    personality = str(args.get("personality", "strategic"))
    move_history = args.get("move_history") or []

    if not isinstance(board, list) or len(board) != 3:
        raise ValueError("board must be a 3x3 array")

    available_moves: list[tuple[int, int]] = []
    for move in available_raw:
        if isinstance(move, dict):
            available_moves.append((int(move["row"]), int(move["col"])))
        elif isinstance(move, (list, tuple)) and len(move) == 2:
            available_moves.append((int(move[0]), int(move[1])))

    if not available_moves:
        raise ValueError("available_moves cannot be empty")

    decision = await suggest_move(
        board=board,
        ai_symbol=ai_symbol,
        user_symbol=user_symbol,
        available=available_moves,
        difficulty=difficulty,
        personality=personality,
        move_history=move_history,
    )
    return {"move": decision}


def register_game_tools(registry: MCPToolRegistry) -> None:
    registry.register(
        MCPTool(
            name="game.suggest_move",
            description="Suggest the next Tic Tac Toe move using LLM reasoning.",
            input_schema={
                "type": "object",
                "required": ["board", "ai_symbol", "user_symbol", "available_moves"],
                "properties": {
                    "board": {"type": "array"},
                    "ai_symbol": {"type": "string"},
                    "user_symbol": {"type": "string"},
                    "available_moves": {"type": "array"},
                    "difficulty": {"type": "string"},
                    "personality": {"type": "string"},
                    "move_history": {"type": "array"},
                },
            },
            output_schema={"type": "object", "properties": {"move": {"type": "object"}}},
            handler=_suggest_game_move,
        )
    )
