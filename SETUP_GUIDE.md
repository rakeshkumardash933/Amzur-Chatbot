# Amzur Chatbot - Full Stack Setup & Deployment Guide

## ✅ What's Been Built

A complete full-stack chat application with:
- **Backend:** FastAPI with PostgreSQL, JWT authentication, LiteLLM integration
- **Frontend:** React + TypeScript with Auth context, protected routes, chat history sidebar
- **Database:** SQLAlchemy ORM with User, Chat, and Message models
- **Security:** Email validation (@amzur.com), bcrypt passwords, JWT tokens

---

## 🚀 Quick Start (5 Minutes)

### Prerequisites
- Python 3.10+ installed
- Node.js 18+ installed
- PostgreSQL database running locally or remote connection
- `.env` file in `backend/` with required variables

### 1. Backend Setup
```bash
cd backend
python -m venv venv
source venv/Scripts/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Initialize database tables
python -c "from app.db.session import engine, Base; from app.models import User, Chat, Message; Base.metadata.create_all(engine)"

# Start server
python main.py
```
✅ Backend runs on `http://localhost:8000`

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
✅ Frontend runs on `http://localhost:5174`

---

## 🧪 Testing the Full Auth Flow

### Option A: Using curl/Postman

#### 1. Register a user
```bash
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@amzur.com","password":"test123"}'
```

#### 2. Login and get JWT token
```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@amzur.com","password":"test123"}'
```

#### 3. Start a new chat
```bash
curl -X POST http://localhost:8000/api/chat/new \
  -H "Authorization: Bearer <your-token-here>"
```

#### 4. Send a chat message
```bash
curl -X POST http://localhost:8000/api/chat \
  -H "Authorization: Bearer <your-token-here>" \
  -H "Content-Type: application/json" \
  -d '{"message":"Hello!","chat_id":1}'
```

### Option B: Using the Web UI

1. Navigate to `http://localhost:5174`
2. Click "Register" tab
3. Enter email (must end with @amzur.com) and password
4. Click "Register" → automatically logged in
5. Click "New Chat" to start conversation
6. Type message and hit Send

---

## 🛠️ Troubleshooting

### Backend Issues

#### "Database connection refused"
- Check DATABASE_URL in `.env`
- Ensure PostgreSQL is running
- Test connection: `psql -U postgres -d amzur_chatbot`

#### "No table named 'users'"
```python
# In Python shell:
from app.db.session import engine, Base
from app.models import User, Chat, Message
Base.metadata.create_all(engine)
```

#### "JWT token validation failed"
- Ensure same SECRET_KEY in `.env`
- Check token not expired (24 hour default)
- Regenerate token by logging in again

#### "LITELLM_API_BASE error"
- Use `http://litellm.amzur.com:4000/v1` (not https)
- Verify LITELLM_API_KEY is valid

### Frontend Issues

#### "Cannot find module '@/...'"
- Check tsconfig.json has `"baseUrl": "."` and `"paths": { "@/*": ["src/*"] }`

#### "Blank page after login"
- Check browser console (F12) for errors
- Verify backend is running: `curl http://localhost:8000/docs`
- Clear localStorage: `localStorage.clear()` in console

#### "CORS error"
- Backend CORS_ORIGINS should include `http://localhost:5174`
- Restart backend after changing config

---

## 📦 Project Structure

```
amzur-chatbot/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth.py         # Login/Register endpoints
│   │   │   └── chat.py         # Chat endpoints
│   │   ├── core/
│   │   │   ├── auth.py         # JWT dependency
│   │   │   └── security.py     # Password hashing, token generation
│   │   ├── db/
│   │   │   └── session.py      # Database connection
│   │   ├── models/
│   │   │   ├── base.py         # SQLAlchemy Base
│   │   │   ├── user.py         # User ORM model
│   │   │   ├── chat.py         # Chat ORM model
│   │   │   ├── message.py      # Message ORM model
│   │   │   └── __init__.py
│   │   ├── schemas/
│   │   │   ├── auth.py         # Request/response schemas
│   │   │   └── chat.py         # Chat schemas
│   │   ├── services/
│   │   │   ├── auth_service.py # Auth business logic
│   │   │   └── chat_service.py # Chat business logic
│   │   ├── config.py           # Environment config
│   │   └── __init__.py
│   ├── main.py                 # FastAPI app
│   ├── requirements.txt        # Python dependencies
│   └── .env                    # Environment variables
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── chat/
│   │   │   │   ├── ChatWindow.tsx    # Main chat UI
│   │   │   │   ├── ChatSidebar.tsx   # Chat history sidebar
│   │   │   │   ├── MessageList.tsx   # Message display
│   │   │   │   └── InputBox.tsx      # Message input
│   │   │   └── ProtectedRoute.tsx    # Route guard
│   │   ├── contexts/
│   │   │   └── AuthContext.tsx       # Auth state management
│   │   ├── hooks/
│   │   │   └── useChat.ts            # Chat API calls
│   │   ├── pages/
│   │   │   └── LoginPage.tsx         # Login/Register form
│   │   ├── App.tsx                   # Main app with routing
│   │   ├── main.tsx                  # React entry point
│   │   └── index.css                 # Global styles
│   ├── vite.config.ts                # Vite config
│   ├── tsconfig.json                 # TypeScript config
│   ├── tailwind.config.ts            # Tailwind CSS
│   ├── postcss.config.js             # PostCSS
│   └── package.json                  # Node dependencies
│
└── SETUP_GUIDE.md                    # This file
```

---

## 📝 API Documentation

### Authentication Endpoints

#### POST `/api/auth/register`
Request: `{"email": "user@amzur.com", "password": "password123"}`
Response: `{"id": 1, "email": "user@amzur.com", "created_at": "2024-01-01T12:00:00"}`

#### POST `/api/auth/login`
Request: `{"email": "user@amzur.com", "password": "password123"}`
Response: `{"access_token": "eyJ0eXAi...", "token_type": "bearer"}`

### Chat Endpoints (Requires JWT)

#### POST `/api/chat/new`
Headers: `Authorization: Bearer {token}`
Response: `{"chat_id": 1, "user_id": 1, "created_at": "2024-01-01T12:00:00"}`

#### GET `/api/chats`
Headers: `Authorization: Bearer {token}`
Response: `[{"id": 1, "user_id": 1, "created_at": "2024-01-01T12:00:00"}]`

#### GET `/api/chats/{chat_id}`
Headers: `Authorization: Bearer {token}`
Response: `{"id": 1, "messages": [...]}`

#### POST `/api/chat`
Headers: `Authorization: Bearer {token}`
Request: `{"message": "Hello!", "chat_id": 1}`
Response: `{"response": "Hi there!", "message_id": 2, "timestamp": "..."}`

---

## 🔒 Security Features

- Email validation (@amzur.com only)
- Bcrypt password hashing (12 salt rounds)
- JWT tokens (HS256, 24-hour expiry)
- Protected routes require valid token
- Database connection pooling
- Environment variables for secrets

---

## 📝 Environment Variables Template

Create `.env` in `backend/` directory:
```
# Database
DATABASE_URL=postgresql+psycopg://user:password@localhost:5432/amzur_chatbot

# Security
SECRET_KEY=your-super-secret-key-here

# LiteLLM
LITELLM_API_KEY=your-litellm-key
LITELLM_API_BASE=http://litellm.amzur.com:4000/v1

# Optional
DEBUG=False
CORS_ORIGINS=http://localhost:5174
```

---

## 🚀 Deployment Checklist

- [ ] Set `SECRET_KEY` to a secure random string
- [ ] Use production PostgreSQL database
- [ ] Verify `LITELLM_API_BASE` is correct
- [ ] Enable HTTPS in production
- [ ] Configure CORS_ORIGINS for production domain
- [ ] Set up environment variables on production server
- [ ] Use httpOnly cookies for JWT tokens (optional)
- [ ] Enable CSRF protection
- [ ] Set up database backups
- [ ] Configure logging

---

## ❓ FAQ

**Q: Can I use SQLite?**
A: Yes, change `DATABASE_URL=sqlite:///./test.db` but PostgreSQL is recommended.

**Q: How do I allow non-@amzur.com emails?**
A: Remove domain check in `backend/app/services/auth_service.py`

**Q: How long do tokens last?**
A: 24 hours by default. Change `ACCESS_TOKEN_EXPIRE_HOURS` in `backend/app/core/security.py`

**Q: How do I reset my password?**
A: Currently, register a new account. Add password reset flow later.

---

## 📊 Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Backend | FastAPI | 0.109.0 |
| ORM | SQLAlchemy | 2.0.23 |
| Database | PostgreSQL | 14+ |
| Auth | python-jose + bcrypt | Latest |
| Frontend | React | 18+ |
| Routing | React Router | 6.20 |
| Styling | Tailwind CSS | 3.3 |
| Language | TypeScript | 5.3 |
| Build | Vite | 5.0 |

---

**Happy chatting! 🎉**
