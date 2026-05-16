"""
Tic Tac Toe API routes powered by an LLM-first AI agent.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from app.agents.tic_tac_toe_agent import choose_ai_move
from app.core.auth import get_current_user
from app.models import User
from app.schemas.game import MoveRequest, RestartGameRequest, StartGameRequest
from app.services.game_service import (
    GameSession,
    MoveRecord,
    apply_move,
    available_moves,
    close_match,
    detect_winner,
    normalize_status,
    reset_board,
    session_payload,
)

router = APIRouter(tags=["game"])

# Per-user in-memory game sessions
_SESSIONS: dict[int, GameSession] = {}


def _get_session(user_id: int) -> GameSession:
    session = _SESSIONS.get(user_id)
    if not session:
        session = GameSession()
        _SESSIONS[user_id] = session
    return session


def _apply_outcome(session: GameSession) -> None:
    outcome = detect_winner(session.board)
    session.status, session.winner = normalize_status(outcome, session.user_symbol, session.ai_symbol)

    if session.status == "user_won":
        session.scores["user"] += 1
        close_match(session)
    elif session.status == "ai_won":
        session.scores["ai"] += 1
        close_match(session)
    elif session.status == "draw":
        session.scores["draw"] += 1
        close_match(session)


@router.post("/api/game/start")
@router.post("/game/start")
async def start_game(
    request: StartGameRequest,
    current_user: User = Depends(get_current_user),
) -> dict:
    session = _get_session(current_user.id)
    session.difficulty = request.difficulty
    session.personality = request.personality
    reset_board(session, reset_scores=False)
    return {"success": True, **session_payload(session)}


@router.post("/api/game/move")
@router.post("/game/move")
async def user_move(
    request: MoveRequest,
    current_user: User = Depends(get_current_user),
) -> dict:
    session = _get_session(current_user.id)

    if session.status != "ongoing":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Game is already finished. Restart to play again.")

    if session.current_turn != "user":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="It is not your turn yet.")

    try:
        apply_move(session.board, request.row, request.col, session.user_symbol)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    session.moves.append(
        MoveRecord(
            turn="user",
            symbol=session.user_symbol,
            row=request.row,
            col=request.col,
            reason="User move",
        )
    )

    # Resolve user outcome first
    _apply_outcome(session)
    if session.status != "ongoing":
        return {"success": True, "ai_move": None, **session_payload(session)}

    # AI turn
    session.current_turn = "ai"
    legal = available_moves(session.board)
    if not legal:
        _apply_outcome(session)
        return {"success": True, "ai_move": None, **session_payload(session)}

    ai_decision = await choose_ai_move(
        board=[row[:] for row in session.board],
        ai_symbol=session.ai_symbol,
        user_symbol=session.user_symbol,
        available_moves=legal,
        difficulty=session.difficulty,
        personality=session.personality,
        move_history=[vars(m) for m in session.moves],
    )

    ai_row = int(ai_decision["row"])
    ai_col = int(ai_decision["col"])

    # Final validation guard for board integrity.
    if (ai_row, ai_col) not in available_moves(session.board):
        fallback = available_moves(session.board)[0]
        ai_row, ai_col = fallback[0], fallback[1]
        ai_decision["reason"] = "Recovered from invalid AI move by selecting a legal cell"
        ai_decision["source"] = "fallback"

    try:
        apply_move(session.board, ai_row, ai_col, session.ai_symbol)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"AI move application failed: {exc}")

    session.moves.append(
        MoveRecord(
            turn="ai",
            symbol=session.ai_symbol,
            row=ai_row,
            col=ai_col,
            reason=str(ai_decision.get("reason", "Strategic move")),
        )
    )

    _apply_outcome(session)
    if session.status == "ongoing":
        session.current_turn = "user"

    response_ai_move = {
        "row": ai_row,
        "col": ai_col,
        "reason": ai_decision.get("reason", ""),
        "confidence": ai_decision.get("confidence", 0.75),
        "source": ai_decision.get("source", "llm"),
    }

    return {"success": True, "ai_move": response_ai_move, **session_payload(session)}


@router.post("/api/game/restart")
@router.post("/game/restart")
async def restart_game(
    request: RestartGameRequest,
    current_user: User = Depends(get_current_user),
) -> dict:
    session = _get_session(current_user.id)

    if request.difficulty is not None:
        session.difficulty = request.difficulty
    if request.personality is not None:
        session.personality = request.personality

    reset_board(session, reset_scores=request.reset_score)
    return {"success": True, **session_payload(session)}


@router.get("/api/game/history")
@router.get("/game/history")
async def game_history(current_user: User = Depends(get_current_user)) -> dict:
    session = _get_session(current_user.id)
    return {
        "success": True,
        "current_game": {
            "game_id": session.game_id,
            "status": session.status,
            "moves": [vars(m) for m in session.moves],
        },
        "history": [
            {
                "game_id": m.game_id,
                "started_at": m.started_at,
                "ended_at": m.ended_at,
                "winner": m.winner,
                "moves": [vars(x) for x in m.moves],
            }
            for m in session.match_history
        ],
        "scores": session.scores,
    }
