"""
Core Tic Tac Toe game state and validation utilities.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Literal

BoardCell = Literal["", "X", "O"]
Board = list[list[BoardCell]]


@dataclass
class MoveRecord:
    turn: Literal["user", "ai"]
    symbol: Literal["X", "O"]
    row: int
    col: int
    reason: str = ""
    timestamp: str = field(default_factory=lambda: datetime.utcnow().isoformat())


@dataclass
class MatchRecord:
    game_id: int
    started_at: str
    ended_at: str
    winner: Literal["user", "ai", "draw"]
    moves: list[MoveRecord]


@dataclass
class GameSession:
    user_symbol: Literal["X", "O"] = "X"
    ai_symbol: Literal["X", "O"] = "O"
    difficulty: Literal["easy", "balanced", "hard"] = "balanced"
    personality: Literal["strategic", "aggressive", "playful"] = "aggressive"
    board: Board = field(default_factory=lambda: empty_board())
    current_turn: Literal["user", "ai"] = "user"
    status: Literal["ongoing", "user_won", "ai_won", "draw"] = "ongoing"
    winner: str = ""
    started_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    game_id: int = 0
    scores: dict[str, int] = field(default_factory=lambda: {"user": 0, "ai": 0, "draw": 0})
    moves: list[MoveRecord] = field(default_factory=list)
    match_history: list[MatchRecord] = field(default_factory=list)


def empty_board() -> Board:
    return [["", "", ""], ["", "", ""], ["", "", ""]]


def is_valid_board(board: Board) -> bool:
    if not isinstance(board, list) or len(board) != 3:
        return False
    for row in board:
        if not isinstance(row, list) or len(row) != 3:
            return False
        for cell in row:
            if cell not in ("", "X", "O"):
                return False
    return True


def available_moves(board: Board) -> list[tuple[int, int]]:
    return [(r, c) for r in range(3) for c in range(3) if board[r][c] == ""]


def apply_move(board: Board, row: int, col: int, symbol: Literal["X", "O"]) -> None:
    if row < 0 or row > 2 or col < 0 or col > 2:
        raise ValueError("Move must be inside the 3x3 board")
    if board[row][col] != "":
        raise ValueError("Cell is already occupied")
    board[row][col] = symbol


def detect_winner(board: Board) -> Literal["X", "O", "draw", "ongoing"]:
    lines: list[list[BoardCell]] = []

    # Rows and columns
    lines.extend(board)
    lines.extend([[board[0][c], board[1][c], board[2][c]] for c in range(3)])

    # Diagonals
    lines.append([board[0][0], board[1][1], board[2][2]])
    lines.append([board[0][2], board[1][1], board[2][0]])

    for line in lines:
        if line[0] and line[0] == line[1] == line[2]:
            return line[0]

    if all(board[r][c] != "" for r in range(3) for c in range(3)):
        return "draw"

    return "ongoing"


def normalize_status(outcome: Literal["X", "O", "draw", "ongoing"], user_symbol: str, ai_symbol: str) -> tuple[str, str]:
    if outcome == "ongoing":
        return "ongoing", ""
    if outcome == "draw":
        return "draw", "draw"
    if outcome == user_symbol:
        return "user_won", "user"
    if outcome == ai_symbol:
        return "ai_won", "ai"
    return "ongoing", ""


def strategic_fallback_move(board: Board, ai_symbol: Literal["X", "O"], user_symbol: Literal["X", "O"]) -> tuple[int, int, str]:
    """
    Deterministic fallback used only when LLM output is invalid or unavailable.
    Priority: win -> block -> center -> corner -> side.
    """
    moves = available_moves(board)
    if not moves:
        raise ValueError("No valid moves available")

    # Win now
    for r, c in moves:
        test = [row[:] for row in board]
        test[r][c] = ai_symbol
        if detect_winner(test) == ai_symbol:
            return r, c, "Taking immediate winning move"

    # Block user win
    for r, c in moves:
        test = [row[:] for row in board]
        test[r][c] = user_symbol
        if detect_winner(test) == user_symbol:
            return r, c, "Blocking opponent winning opportunity"

    # Center
    if (1, 1) in moves:
        return 1, 1, "Taking center for stronger board control"

    # Corners then sides
    for cand in [(0, 0), (0, 2), (2, 0), (2, 2), (0, 1), (1, 0), (1, 2), (2, 1)]:
        if cand in moves:
            return cand[0], cand[1], "Selecting best available strategic position"

    return moves[0][0], moves[0][1], "Selecting available move"


def close_match(session: GameSession) -> None:
    if session.status not in ("user_won", "ai_won", "draw"):
        return

    session.match_history.insert(
        0,
        MatchRecord(
            game_id=session.game_id,
            started_at=session.started_at,
            ended_at=datetime.utcnow().isoformat(),
            winner=session.winner if session.winner in ("user", "ai", "draw") else "draw",
            moves=[MoveRecord(**vars(m)) for m in session.moves],
        ),
    )
    session.match_history = session.match_history[:50]


def reset_board(session: GameSession, reset_scores: bool = False) -> GameSession:
    session.board = empty_board()
    session.current_turn = "user" if session.user_symbol == "X" else "ai"
    session.status = "ongoing"
    session.winner = ""
    session.started_at = datetime.utcnow().isoformat()
    session.game_id += 1
    session.moves = []
    if reset_scores:
        session.scores = {"user": 0, "ai": 0, "draw": 0}
    return session


def session_payload(session: GameSession) -> dict:
    return {
        "board": session.board,
        "current_turn": session.current_turn,
        "status": session.status,
        "winner": session.winner,
        "scores": session.scores,
        "difficulty": session.difficulty,
        "personality": session.personality,
        "game_id": session.game_id,
        "moves": [vars(m) for m in session.moves],
    }
