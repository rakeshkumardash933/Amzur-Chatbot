# Amzur AI Chat — Project Setup

This is the scaffolding for the Amzur AI Chat platform. Structure and configuration files are in place; feature development can now begin.

## Project Structure

```
/
├── frontend/              # React + TypeScript + Tailwind + Vite
│   ├── src/
│   │   ├── components/    # UI components (chat, auth, attachments)
│   │   ├── pages/         # Page-level components
│   │   ├── hooks/         # Custom React hooks
│   │   ├── lib/           # API client
│   │   ├── types/         # Shared TypeScript interfaces
│   │   ├── index.css      # Tailwind imports
│   │   └── main.tsx       # Entry point
│   ├── index.html         # HTML template
│   ├── package.json       # Dependencies
│   ├── vite.config.ts     # Vite configuration
│   ├── tsconfig.json      # TypeScript configuration
│   ├── tailwind.config.js # Tailwind CSS configuration
│   ├── .env.example       # Environment variable template
│   └── .gitignore
│
└── backend/               # FastAPI + Python 3.11+
    ├── app/
    │   ├── api/           # Route handlers (HTTP only)
    │   ├── services/      # Business logic
    │   ├── models/        # SQLAlchemy ORM models
    │   ├── schemas/       # Pydantic request/response schemas
    │   ├── ai/
    │   │   ├── llm.py     # LiteLLM client singletons
    │   │   ├── chains/    # LCEL chains
    │   │   ├── memory/    # Conversation memory utilities
    │   │   ├── rag/       # ChromaDB client and retrieval
    │   │   └── prompts/   # Prompt templates
    │   ├── db/
    │   │   └── session.py # Database session factory
    │   └── core/
    │       ├── config.py  # Settings from environment
    │       └── logging.py # Logging setup
    ├── main.py            # FastAPI app entry point
    ├── requirements.txt   # Python dependencies
    ├── .env.example       # Environment variable template
    └── .gitignore
```

## Getting Started

### Backend Setup

1. **Create a virtual environment:**
   ```bash
   cd backend
   python -m venv venv
   source venv/Scripts/activate  # On Windows: venv\Scripts\activate
   ```

2. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your database URL, API keys, etc.
   ```

4. **Create database and run migrations:**
   ```bash
   # Create PostgreSQL database first
   # Then run Alembic migrations (when ready):
   alembic upgrade head
   ```

5. **Start the development server:**
   ```bash
   python main.py
   # Or with uvicorn directly:
   uvicorn main:app --reload
   ```
   Server runs on `http://localhost:8000`

### Frontend Setup

1. **Install dependencies:**
   ```bash
   cd frontend
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env if needed (defaults to localhost:8000)
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```
   App runs on `http://localhost:5173`

## Configuration

### Environment Variables

**Backend** — See `backend/.env.example` for all required variables:
- `DATABASE_URL`: PostgreSQL connection string
- `SECRET_KEY`: JWT signing key
- `LITELLM_API_KEY`: API key for the Amzur LiteLLM proxy
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`: OAuth credentials (optional)

**Frontend** — See `frontend/.env.example`:
- `VITE_API_URL`: Backend API URL (defaults to `http://localhost:8000/api`)

## Architecture & Conventions

### Backend
- **Layered architecture**: Routers → Services → Models, no mixed concerns
- **All async**: FastAPI route handlers use `async def`
- **Type-safe**: SQLAlchemy 2.0 style, Pydantic schemas
- **Single AI gateway**: All LLM/embedding calls through `app/ai/llm.py`
- **No hardcoded secrets**: Environment variables only

### Frontend
- **Functional components**: React hooks only
- **TypeScript strict mode**: No `any` types allowed
- **Tailwind CSS**: Inline utilities, no custom CSS unless necessary
- **API client**: All calls through `src/lib/api.ts`
- **Shared types**: All API response types in `src/types/index.ts`
- **Dark mode**: Via `dark:` variant in Tailwind (no JS toggling)

## Next Steps

1. **API routes**: Implement auth routes (login, Google OAuth, token refresh) in `backend/app/api/`
2. **Authentication service**: User creation, JWT issuance in `backend/app/services/`
3. **Database models**: Define User, Thread, Message tables in `backend/app/models/`
4. **Frontend auth**: Login/signup components, auth context/store
5. **Chat feature**: Message routes, chat service, chat UI components

---

**All secrets must come from environment variables. Never commit `.env` files.**
