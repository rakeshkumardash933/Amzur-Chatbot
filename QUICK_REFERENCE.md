# 📋 Quick Reference Card

## 🚀 Quick Start (Copy & Paste)

### Windows
```batch
.\start.bat
```

### macOS/Linux
```bash
bash start.sh
```

---

## 🔑 REQUIRED: Google Gemini API Key

1. Visit: https://makersuite.google.com/app/apikey
2. Click "Create API Key"
3. Copy the key
4. Open `backend/.env`
5. Add: `GOOGLE_GEMINI_API_KEY=your-key-here`
6. Save and restart backend

**Without this, chatbot won't work!**

---

## 📍 URLs

| Service | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| Backend | http://localhost:8000 |
| API Base | http://localhost:8000/api |
| Health Check | http://localhost:8000/health |

---

## 🔌 Main API Endpoint

### Chat Endpoint

**POST** `/api/chat/`

```bash
curl -X POST http://localhost:8000/api/chat/ \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Hello!",
    "session_id": "session_123"
  }'
```

**Response:**
```json
{
  "response": "Hello! How can I help?",
  "session_id": "session_123",
  "message_count": 2
}
```

---

## 🛠️ Manual Setup (No Quick Start Script)

### Backend

```bash
cd backend
python -m venv venv

# Activate (choose one):
source venv/bin/activate              # macOS/Linux
venv\Scripts\activate                 # Windows (CMD)
. venv/Scripts/Activate.ps1          # Windows (PowerShell)

pip install -r requirements.txt
cp .env.example .env

# Edit .env and add GOOGLE_GEMINI_API_KEY

python main.py
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

---

## ✅ Verify Setup Works

```bash
# Test 1: Backend health
curl http://localhost:8000/health

# Test 2: Run diagnostic
cd backend
python diagnostic.py

# Test 3: Send a message
curl -X POST http://localhost:8000/api/chat/ \
  -H "Content-Type: application/json" \
  -d '{"message":"Hello","session_id":"test123"}'
```

---

## 📁 Important Files

### Backend
| File | Purpose |
|------|---------|
| `backend/.env` | Your API keys (CREATE FROM .env.example) |
| `backend/main.py` | FastAPI app entry point |
| `backend/app/api/chat.py` | Chat endpoint routes |
| `backend/app/services/chat_service.py` | Chat business logic |

### Frontend
| File | Purpose |
|------|---------|
| `frontend/.env` | Frontend config (usually doesn't need editing) |
| `frontend/src/App.tsx` | Main app component |
| `frontend/src/components/chat/ChatWindow.tsx` | Chat UI container |
| `frontend/src/hooks/useChat.ts` | Chat state management |

---

## 🐛 Common Issues & Fixes

### Issue: "Cannot connect to backend"
```bash
# Check backend is running
curl http://localhost:8000/health

# If fails, start backend:
cd backend && python main.py
```

### Issue: "API key not set" error
```
✗ Add GOOGLE_GEMINI_API_KEY to backend/.env
✗ Restart backend after editing .env
```

### Issue: "Port 8000 already in use"
```bash
# Windows: Find and kill process
netstat -ano | findstr :8000
taskkill /PID <PID> /F

# macOS/Linux: Find and kill process
lsof -i :8000
kill -9 <PID>

# Or edit backend/main.py and change port
```

### Issue: "Module not found" error
```bash
# Check virtual environment is activated
source venv/bin/activate  # or your OS equivalent

# Reinstall dependencies
pip install -r requirements.txt
```

### Issue: Frontend shows blank or error
```bash
# Check browser console for errors (F12)
# Ensure backend is running
# Check VITE_API_URL in frontend/.env
```

---

## 💾 Environment Variables

### Required (Backend)

```env
GOOGLE_GEMINI_API_KEY=your-api-key-from-google
```

### Optional (Backend)

```env
DEBUG=True
GEMINI_MODEL=gemini-pro
CORS_ORIGINS=["http://localhost:5173"]
LOG_LEVEL=INFO
```

### Frontend

```env
VITE_API_URL=http://localhost:8000/api
```

---

## 🎯 Development Workflow

### Add a New Feature

1. **Plan** the feature (check conventions in copilot-instructions.md)
2. **Backend**: Add service logic → Add routes → Test with curl
3. **Frontend**: Add component → Connect to API via useChat hook
4. **Test** both together
5. **Commit** with clear message

### Debug Backend

```bash
# View logs in terminal (running `python main.py`)
# Add print statements to chat_service.py
# Use browser DevTools → Network tab to see API requests
```

### Debug Frontend

```bash
# Open browser DevTools (F12)
# Console tab: See errors and logs
# Network tab: View API requests/responses
# Components tab: Inspect React component state
```

---

## 📚 Documentation Files

| File | Purpose |
|------|---------|
| README.md | Project overview |
| SETUP_GUIDE.md | Detailed setup instructions |
| API_DOCS.md | API endpoint documentation |
| ARCHITECTURE.md | System architecture diagrams |
| IMPLEMENTATION_SUMMARY.md | What was built |
| copilot-instructions.md | Full project spec |

---

## 🚀 Next Steps After First Run

- [ ] Get Google Gemini API key and configure
- [ ] Run both servers and test
- [ ] Explore the code (start with `frontend/src/App.tsx`)
- [ ] Try modifying a component or API response
- [ ] Check out [API_DOCS.md](API_DOCS.md) for more endpoints
- [ ] Add database persistence (PostgreSQL)
- [ ] Deploy frontend and backend

---

## 💡 Tips & Tricks

**Session IDs**
- Frontend generates unique ID automatically per conversation
- Same session_id = related messages (conversation memory)
- Different session_id = new conversation

**Typing Effect**
- Controlled in `frontend/src/components/chat/Message.tsx`
- Adjust delay: `interval`, 20ms (faster) to 50ms (slower)

**Error Handling**
- Backend returns structured errors
- Frontend displays them in red box
- Check browser console for detailed errors

**API Testing**
- Use cURL or Postman for quick API testing
- See [API_DOCS.md](API_DOCS.md) for examples
- Test health endpoint first: `curl http://localhost:8000/health`

---

## 🎨 Customization Cheat Sheet

### Change Bot Response Speed (Typing Effect)
```typescript
// In frontend/src/components/chat/Message.tsx
// Change this value (milliseconds):
}, 20)  // ← 20ms = fast, try 50ms for slower
```

### Change API Colors
```jsx
// In frontend/src/components/chat/Message.tsx
const bgColor = isUser ? 'bg-blue-500' : 'bg-gray-300'
// Change: blue-500 to blue-600, gray-300 to green-300, etc.
```

### Add System Prompt
```python
# In backend/app/services/chat_service.py
# Add to llm.ainvoke() call:
system_prompt = "You are a helpful assistant..."
# Include in conversation history before user messages
```

---

## 📞 Support Resources

1. **Setup issues?** → Read [SETUP_GUIDE.md](SETUP_GUIDE.md)
2. **API questions?** → Read [API_DOCS.md](API_DOCS.md)
3. **Architecture?** → Read [ARCHITECTURE.md](ARCHITECTURE.md)
4. **Want details?** → Read [copilot-instructions.md](copilot-instructions.md)

---

## ⚡ Performance Tips

- Frontend: Uses Vite (ultra-fast dev builds)
- Backend: Uses async/await (non-blocking)
- AI: Google Gemini is fast, first call slower due to model loading
- Network: Optimize with gzip compression in production

---

## 🔒 Security Checklist

- ✅ API keys in .env only (never in code)
- ✅ .env files in .gitignore (never commit)
- ✅ CORS configured for frontend only
- ✅ Input validated with Pydantic
- ✅ Errors don't expose internals
- ✅ All secrets from environment variables

---

## 📊 Project Stats

- **Backend**: ~200 lines of code (FastAPI + LangChain)
- **Frontend**: ~400 lines of code (React + TypeScript)
- **Dependencies**: ~30 Python packages, ~20 npm packages
- **Time to setup**: ~5 minutes (with quick start script)
- **Features**: Chat, session management, typing effect, error handling

---

**Stuck?** Start here:
1. Check [SETUP_GUIDE.md](SETUP_GUIDE.md)
2. Run diagnostic: `python backend/diagnostic.py`
3. Check browser console (F12)
4. Verify `GOOGLE_GEMINI_API_KEY` in `backend/.env`

**Enjoy! 🎉**
