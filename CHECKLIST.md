# ✅ Setup & Deployment Checklist

## 🎯 Pre-Launch Checklist

### 1️⃣ Prerequisites
- [ ] Python 3.11 or higher installed (`python --version`)
- [ ] Node.js 18 or higher installed (`node --version`)
- [ ] Google Gemini API key obtained ([Get key](https://makersuite.google.com/app/apikey))
- [ ] Text editor or IDE (VS Code recommended)
- [ ] Git installed (if planning to version control)

### 2️⃣ Google Gemini API Setup
- [ ] Signed up for Google AI Studio
- [ ] Created an API key
- [ ] **Copied the API key** (you'll need this!)
- [ ] Have API key ready for .env file

### 3️⃣ Backend Setup
- [ ] Opened `backend/.env.example`
- [ ] Created `backend/.env` from template
- [ ] **Added** `GOOGLE_GEMINI_API_KEY=your-key-here` to `backend/.env`
- [ ] Installed Python dependencies: `pip install -r requirements.txt`
- [ ] Virtual environment activated
- [ ] No errors when importing packages

### 4️⃣ Frontend Setup
- [ ] Created `frontend/.env` from `frontend/.env.example`
- [ ] Checked VITE_API_URL points to backend (usually http://localhost:8000/api)
- [ ] Ran `npm install` in frontend directory
- [ ] No errors in installation

### 5️⃣ Pre-Test Verification
- [ ] Backend `.env` file exists and has GOOGLE_GEMINI_API_KEY
- [ ] Frontend `.env` file exists (even if empty/default)
- [ ] Both `main.py` and `package.json` exist in their directories
- [ ] No syntax errors in files (check your editor)

---

## 🚀 Launch Checklist

### First Run
- [ ] **Terminal 1 - Backend:**
  ```bash
  cd backend
  python main.py
  # Should see: "Uvicorn running on http://0.0.0.0:8000"
  ```

- [ ] **Terminal 2 - Frontend:**
  ```bash
  cd frontend
  npm run dev
  # Should see: "Local: http://localhost:5173"
  ```

- [ ] Opened browser to `http://localhost:5173`
- [ ] See Amzur Chatbot header
- [ ] Can see input box and send button
- [ ] No red errors in browser console (F12)

### Test Chat Functionality
- [ ] Typed a message: "Hello!"
- [ ] Clicked "Send" button
- [ ] Loading indicator appeared (bouncing dots)
- [ ] AI response appeared within 10 seconds
- [ ] Typing effect played (response animated character by character)
- [ ] Can send another message
- [ ] "Clear" button works (clears all messages)

### Verify API Connection
- [ ] Backend console shows POST requests
- [ ] Frontend console has no error messages
- [ ] Messages appearing means API is working
- [ ] If getting error: check that backend is still running

---

## 🔧 Troubleshooting Checklist

### Backend Won't Start
- [ ] Python 3.11+ installed? (`python --version`)
- [ ] In `backend` directory? (`cd backend`)
- [ ] Virtual environment activated? (should see `(venv)` in prompt)
- [ ] Dependencies installed? (`pip install -r requirements.txt`)
- [ ] `.env` file exists? (`backend/.env`)
- [ ] GOOGLE_GEMINI_API_KEY in `.env`?
- [ ] Port 8000 free? (not in use by another app)
  ```bash
  # If port in use, try:
  # Windows: netstat -ano | findstr :8000
  # macOS/Linux: lsof -i :8000
  ```

### Frontend Won't Start
- [ ] Node.js 18+ installed? (`node --version`)
- [ ] In `frontend` directory? (`cd frontend`)
- [ ] Dependencies installed? (`npm install`)
- [ ] `.env` file exists? (`frontend/.env`)
- [ ] Port 5173 free? (not in use)
- [ ] Check for error messages: `npm run dev`

### API Connection Fails
- [ ] Backend is running? (http://localhost:8000/health)
- [ ] GOOGLE_GEMINI_API_KEY set correctly in backend/.env?
- [ ] API key is valid? (check it wasn't truncated when copying)
- [ ] VITE_API_URL correct in frontend/.env?
- [ ] Check browser console (F12) for detailed errors
- [ ] Check backend terminal for error messages

### AI Doesn't Respond
- [ ] Is backend still running? (check terminal)
- [ ] GOOGLE_GEMINI_API_KEY valid?
- [ ] Internet connection working?
- [ ] Check browser console for error messages
- [ ] Try shorter message (sometimes longer messages timeout)
- [ ] Restart both servers

### Typing Effect Too Fast/Slow
- [ ] Open `frontend/src/components/chat/Message.tsx`
- [ ] Find line: `}, 20)` (interval in milliseconds)
- [ ] Change to: `}, 30)` (slower) or `}, 10)` (faster)
- [ ] Save file (will auto-refresh in browser)

---

## 📊 Verification Tests

### ✅ Health Check
```bash
curl http://localhost:8000/health
# Expected: {"status":"ok"}
```

### ✅ Chat API Test
```bash
curl -X POST http://localhost:8000/api/chat/ \
  -H "Content-Type: application/json" \
  -d '{"message":"What is 2+2?","session_id":"test_123"}'
# Expected: {"response":"4","session_id":"test_123","message_count":1}
```

### ✅ Diagnostic Check
```bash
cd backend
python diagnostic.py
# Should show: "All checks passed!"
```

---

## 📋 Post-Launch Checklist

### Code Quality
- [ ] No errors in browser console (F12)
- [ ] No errors in backend terminal
- [ ] Code follows [conventions](copilot-instructions.md)
- [ ] No hardcoded secrets in code

### Functionality
- [ ] Messages display correctly
- [ ] Typing effect works
- [ ] Loading indicator shows
- [ ] Clear button works
- [ ] Multi-line input works (Shift+Enter)
- [ ] Error handling works

### Testing
- [ ] Tested with various messages
- [ ] Tested session persistence (same session_id remembers conversation)
- [ ] Tested clearing chat
- [ ] Tested sending very long message
- [ ] Tested rapid message sending

### Documentation
- [ ] Read [SETUP_GUIDE.md](SETUP_GUIDE.md) ✓
- [ ] Reviewed [API_DOCS.md](API_DOCS.md) ✓
- [ ] Checked [ARCHITECTURE.md](ARCHITECTURE.md) ✓
- [ ] Explored [QUICK_REFERENCE.md](QUICK_REFERENCE.md) ✓
- [ ] Understands project structure ✓

---

## 🎓 Learning Path

### Quick Understanding (5 minutes)
1. Read [README.md](README.md)
2. Run application successfully
3. Send a few messages to Gemini

### Moderate Understanding (30 minutes)
4. Read [ARCHITECTURE.md](ARCHITECTURE.md)
5. Explore `frontend/src/App.tsx`
6. Explore `backend/main.py`
7. Check out `frontend/src/hooks/useChat.ts`

### Deep Understanding (1-2 hours)
8. Read [copilot-instructions.md](copilot-instructions.md)
9. Review entire frontend code structure
10. Review entire backend code structure
11. Trace a message from UI → API → Gemini → Response

### Advanced Topics (2+ hours)
12. Study LangChain integration in `chat_service.py`
13. Understand Pydantic models in `schemas/`
14. Learn about in-memory conversation storage
15. Plan database persistence upgrade

---

## 🚀 Optional Enhancements

### Short Term (1-2 days)
- [ ] Add message timestamps display
- [ ] Persist chat to localStorage (survives page refresh)
- [ ] Add copy-to-clipboard button for messages
- [ ] Add emoji reaction buttons
- [ ] Improve error messages

### Medium Term (1-2 weeks)
- [ ] Connect to PostgreSQL database
- [ ] Add user authentication
- [ ] Save chat history per user
- [ ] Add chat title/naming
- [ ] Export chat as JSON/PDF

### Long Term (1+ months)
- [ ] Streaming responses (SSE)
- [ ] Image uploads and analysis
- [ ] File uploads (PDF, Excel, etc.)
- [ ] Custom system prompts
- [ ] Multiple AI model selection
- [ ] Rate limiting
- [ ] Analytics dashboard

---

## 🔐 Security Checklist

### Before Sharing Code
- [ ] No API keys in any files except `.env`
- [ ] `.env` is in `.gitignore`
- [ ] Never committed `.env` to git
- [ ] No hardcoded database URLs
- [ ] No secrets in comments
- [ ] CORS configured properly

### Before Production Deployment
- [ ] Set `DEBUG=False` in backend `.env`
- [ ] Use strong `SECRET_KEY` (not dev key)
- [ ] Enable HTTPS everywhere
- [ ] Use environment variable management (Secrets Manager, etc.)
- [ ] Update CORS_ORIGINS to production domains
- [ ] Use database instead of in-memory storage
- [ ] Set up proper error logging
- [ ] Rate limit API endpoints

---

## 📞 Quick Help

| Problem | Action |
|---------|--------|
| Backend won't start | Run `python diagnostic.py` |
| Can't find .env file | Run `cp .env.example .env` in the directory |
| "Port already in use" | Kill process using port, or change port number |
| API key not working | Verify key is correct (check Google AI Studio) |
| Messages not displaying | Check browser console (F12) for errors |
| Typing effect missing | Ensure `frontend/src/components/chat/Message.tsx` has it |

---

## ✨ Success Indicators

You'll know everything is working when:

1. ✅ **Both servers start without errors**
   - Backend: "Uvicorn running on http://0.0.0.0:8000"
   - Frontend: "Local: http://localhost:5173"

2. ✅ **Frontend loads successfully**
   - See "Amzur Chatbot" header
   - Input box and send button visible
   - No red errors in console

3. ✅ **Can send messages**
   - Type "Hello"
   - Click Send
   - Loading dots appear
   - AI response arrives within seconds

4. ✅ **Typing effect works**
   - Response animates character by character
   - Feel the magic ✨

5. ✅ **Can clear chat**
   - Click Clear button
   - All messages disappear
   - Can start fresh conversation

---

## 🎉 You're All Set!

If you've completed all checkboxes above, your Amzur Chatbot is **fully functional and ready to use**!

### Next Steps:
1. **Use it!** Send messages and explore what Gemini can do
2. **Customize it!** Make it your own
3. **Extend it!** Add database, authentication, etc.
4. **Deploy it!** Share with others

---

**Happy chatting! 🤖✨**

For more help, check the documentation:
- 📖 [SETUP_GUIDE.md](SETUP_GUIDE.md)
- 🔌 [API_DOCS.md](API_DOCS.md)
- 🏗️ [ARCHITECTURE.md](ARCHITECTURE.md)
- 📋 [QUICK_REFERENCE.md](QUICK_REFERENCE.md)
