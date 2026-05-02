# 🤖 Amzur AI Chatbot

A full-stack, production-ready chatbot application built with **FastAPI + React + TypeScript** and powered by **Google Gemini AI**.

## ✨ Features

### Backend
- ⚡ **FastAPI** with async/await
- 🤖 **Google Gemini Integration** via LangChain
- 💬 **In-memory conversation history** per session
- 🔄 **Session management** with unique IDs
- 🛡️ **Structured error handling**
- 📝 **Pydantic validation** for all requests
- 🌐 **CORS enabled** for frontend integration
- 📚 **Full API documentation** included

### Frontend
- ⚛️ **React 18** with TypeScript and strict mode
- 🎨 **Tailwind CSS** with dark mode support
- ✍️ **Typing effect** for AI responses
- 💫 **Auto-scroll** to latest message
- ⏳ **Loading indicators** while waiting for response
- 🎯 **Responsive design** for all devices
- 🔌 **Axios API client** singleton
- 📤 **Multi-line input** with Shift+Enter support
- 🗑️ **Clear chat** button for new conversations

## 📚 Documentation

- 📖 **[SETUP_GUIDE.md](SETUP_GUIDE.md)** — Detailed setup instructions
- 🔌 **[API_DOCS.md](API_DOCS.md)** — Complete API documentation
- 📋 **[copilot-instructions.md](copilot-instructions.md)** — Project specification

## 🚀 Quick Start

### Windows
```bash
.\start.bat
```

### macOS/Linux
```bash
bash start.sh
```

Or follow the [detailed setup guide](SETUP_GUIDE.md).

## 📋 Prerequisites

- **Python 3.11+** (backend)
- **Node.js 18+** (frontend)
- **Google Gemini API Key** ([get free key](https://makersuite.google.com/app/apikey))

## 🏗️ Project Structure

```
amzur-chatbot/
├── backend/                      # FastAPI backend
│   ├── app/
│   │   ├── api/chat.py          # Chat routes
│   │   ├── services/
│   │   │   └── chat_service.py  # Chat logic
│   │   ├── schemas/
│   │   │   └── chat.py          # Pydantic models
│   │   └── core/
│   │       ├── config.py        # Settings
│   │       └── logging.py
│   ├── main.py                  # FastAPI app
│   ├── requirements.txt
│   ├── diagnostic.py            # Verification tool
│   └── .env.example
│
├── frontend/                     # React frontend
│   ├── src/
│   │   ├── components/chat/
│   │   │   ├── ChatWindow.tsx   # Main container
│   │   │   ├── MessageList.tsx
│   │   │   ├── InputBox.tsx
│   │   │   └── Message.tsx
│   │   ├── hooks/
│   │   │   └── useChat.ts
│   │   ├── lib/
│   │   │   └── api.ts           # API client
│   │   ├── types/
│   │   │   └── index.ts
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── .env.example
│
├── SETUP_GUIDE.md
├── API_DOCS.md
└── README.md
```

## 🎯 Tech Stack

**Backend**: FastAPI + LangChain + Google Gemini + Pydantic
**Frontend**: React 18 + TypeScript + Vite + Tailwind CSS

## 📱 How to Use

1. **Start both servers** (in separate terminals):
   ```bash
   # Terminal 1: Backend
   cd backend
   python main.py
   
   # Terminal 2: Frontend
   cd frontend
   npm run dev
   ```

2. **Open browser**: `http://localhost:5173`

3. **Type a message and press Send**

4. **Watch the AI respond** with typing effect!

## 🔧 Configuration

### Backend `.env`

```env
GOOGLE_GEMINI_API_KEY=your-api-key-here
GEMINI_MODEL=gemini-pro
DEBUG=True
```

### Frontend `.env`

```env
VITE_API_URL=http://localhost:8000/api
```

## 🧪 Testing

**Verify setup:**
```bash
cd backend
python diagnostic.py
```

**Test API:**
```bash
curl -X POST http://localhost:8000/api/chat/ \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello!", "session_id": "test_123"}'
```

## 📖 API Overview

**POST** `/api/chat/`

Request:
```json
{
  "message": "What is AI?",
  "session_id": "user_session_123"
}
```

Response:
```json
{
  "response": "AI stands for...",
  "session_id": "user_session_123",
  "message_count": 2
}
```

See [API_DOCS.md](API_DOCS.md) for complete documentation.

## 🐛 Troubleshooting

| Problem | Solution |
|---------|----------|
| "Connection refused" | Start backend: `python backend/main.py` |
| "API key not set" | Add to `backend/.env`: `GOOGLE_GEMINI_API_KEY=...` |
| "Frontend error" | Check backend health: `curl http://localhost:8000/health` |
| Port 8000 in use | Kill process or change port in `main.py` |

More help: See [SETUP_GUIDE.md](SETUP_GUIDE.md#-troubleshooting)

## 📚 Next Steps

- [ ] Database persistence
- [ ] User authentication
- [ ] Message history per user
- [ ] Streaming responses
- [ ] Multi-modal input
- [ ] Rate limiting
- [ ] Analytics

## 🔐 Security

- ✅ API keys in environment variables only
- ✅ CORS configured
- ✅ Input validation
- ✅ No hardcoded secrets
- ✅ .env files in .gitignore

## 📝 Code Quality

- ✅ TypeScript strict mode
- ✅ Async/await everywhere
- ✅ Clean architecture
- ✅ Structured error handling
- ✅ Type-safe code

---

**Happy chatting! 🎉**

Need help? Check [SETUP_GUIDE.md](SETUP_GUIDE.md) or [API_DOCS.md](API_DOCS.md).
