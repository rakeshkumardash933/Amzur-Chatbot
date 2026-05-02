# 🏗️ System Architecture

## Complete Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        BROWSER (Frontend)                        │
│                    http://localhost:5173                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  ChatWindow Component                                    │   │
│  ├──────────────────────────────────────────────────────────┤   │
│  │                                                          │   │
│  │  ┌──────────────────────────────────────────────────┐   │   │
│  │  │ MessageList                                      │   │   │
│  │  │ ┌──────────────────────────────────────────────┐ │   │   │
│  │  │ │ Message (User)                               │ │   │   │
│  │  │ │ "What is AI?"                                │ │   │   │
│  │  │ │ ← Blue bubble, right-aligned               │ │   │   │
│  │  │ └──────────────────────────────────────────────┘ │   │   │
│  │  │                                                  │   │   │
│  │  │ ┌──────────────────────────────────────────────┐ │   │   │
│  │  │ │ Message (Assistant + Typing Effect)         │ │   │   │
│  │  │ │ "AI is artificial intelligence..."          │ │   │   │
│  │  │ │ ← Gray bubble, left-aligned, animated      │ │   │   │
│  │  │ └──────────────────────────────────────────────┘ │   │   │
│  │  │                                                  │   │   │
│  │  │ Auto-scroll to bottom ↓                         │   │   │
│  │  └──────────────────────────────────────────────────┘   │   │
│  │                                                          │   │
│  │  ┌──────────────────────────────────────────────────┐   │   │
│  │  │ InputBox                                         │   │   │
│  │  │ ┌──────────────────────────────────────────────┐ │   │   │
│  │  │ │ [Clear Button] [Textarea] [Send Button]      │ │   │   │
│  │  │ │                                              │ │   │   │
│  │  │ │ Textarea auto-expands, Shift+Enter = newline│ │   │   │
│  │  │ │ Loading spinner on Send while waiting       │ │   │   │
│  │  │ └──────────────────────────────────────────────┘ │   │   │
│  │  └──────────────────────────────────────────────────┘   │   │
│  │                                                          │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
                                ↓
                            (HTTP POST)
                                ↓
┌─────────────────────────────────────────────────────────────────┐
│                      NETWORK / INTERNET                          │
└─────────────────────────────────────────────────────────────────┘
                                ↓
                                ↓
┌─────────────────────────────────────────────────────────────────┐
│                  FastAPI Backend Server                          │
│                   http://localhost:8000                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Router: POST /api/chat/                                  │   │
│  │ (app/api/chat.py)                                        │   │
│  │                                                          │   │
│  │ ✓ Validate request with Pydantic                       │   │
│  │ ✓ Extract: message, session_id                         │   │
│  │ └──────────────────────────────────────────────────────┘   │
│           ↓                                                     │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ ChatService                                              │   │
│  │ (app/services/chat_service.py)                           │   │
│  │                                                          │   │
│  │ ┌────────────────────────────────────────────────────┐  │   │
│  │ │ In-Memory Conversation Store                       │  │   │
│  │ │ {                                                  │  │   │
│  │ │   "session_123": [                                 │  │   │
│  │ │     HumanMessage("Hello"),                         │  │   │
│  │ │     AIMessage("Hi there!"),                        │  │   │
│  │ │     ...                                            │  │   │
│  │ │   ]                                                │  │   │
│  │ │ }                                                  │  │   │
│  │ └────────────────────────────────────────────────────┘  │   │
│  │                                                          │   │
│  │ 1. Add user message to history                          │   │
│  │ 2. Pass entire history to LangChain                     │   │
│  │ 3. Invoke Gemini model via LangChain                    │   │
│  │ 4. Extract response content                            │   │
│  │ 5. Add AI response to history                          │   │
│  │ 6. Return response                                     │   │
│  │ └──────────────────────────────────────────────────────┘   │
│           ↓                                                     │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ LangChain + Google Gemini (via internet)                 │   │
│  │ (app/ai/llm.py - client singleton)                       │   │
│  │                                                          │   │
│  │ from langchain_google_genai import ChatGoogleGenerativeAI│  │
│  │ llm = ChatGoogleGenerativeAI(                            │   │
│  │   model="gemini-pro",                                   │   │
│  │   google_api_key=settings.GOOGLE_GEMINI_API_KEY         │   │
│  │ )                                                        │   │
│  │                                                          │   │
│  │ response = llm.ainvoke(conversation_history)            │   │
│  │ └──────────────────────────────────────────────────────┘   │
│           ↓                                                     │
└─────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────┐
│                   Google Gemini API                              │
│              https://gemini.googleapis.com/v1/                   │
│                                                                   │
│ ✓ Process conversation history                                  │
│ ✓ Generate response                                             │
│ ✓ Return complete text                                          │
└─────────────────────────────────────────────────────────────────┘
                                ↓
                          (HTTP Response)
                                ↓
┌─────────────────────────────────────────────────────────────────┐
│                    Backend → Frontend                            │
│                                                                   │
│ HTTP 200 Response:                                              │
│ {                                                               │
│   "response": "AI is artificial intelligence...",              │
│   "session_id": "session_123",                                │
│   "message_count": 2                                           │
│ }                                                               │
└─────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────┐
│                    Frontend Update                               │
│                                                                   │
│ 1. useChat hook receives response                               │
│ 2. Set messages state                                           │
│ 3. MessageList re-renders                                       │
│ 4. Message component triggers typing effect                    │
│ 5. Content animated character-by-character                     │
│ 6. Auto-scroll to latest message                               │
│ 7. Input field enabled, user can send next message             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Component Hierarchy (Frontend)

```
App
└── ChatWindow
    ├── Header
    │   ├── Title: "Amzur Chatbot"
    │   └── Subtitle: "Powered by Google Gemini"
    │
    ├── Error Alert (conditional)
    │   └── Error message and details
    │
    ├── MessageList
    │   ├── Empty state (first load)
    │   │   └── "Welcome to Amzur Chat"
    │   │
    │   └── Messages (loop)
    │       └── Message
    │           ├── User message (blue)
    │           │   └── Align right
    │           │
    │           └── Assistant message (gray)
    │               ├── Align left
    │               └── Typing effect (animated)
    │
    ├── Loading Indicator (conditional)
    │   └── Three bouncing dots
    │
    └── InputBox
        ├── Clear Button (red)
        ├── Textarea (expandable)
        └── Send Button (blue, with spinner)
```

---

## State Management (Frontend)

### useChat Hook State:
```typescript
{
  messages: ChatMessage[],      // Array of messages
  isLoading: boolean,            // API call in progress
  error: string | null,          // Error message
  sessionId: string,             // Unique session ID
}
```

### ChatMessage Structure:
```typescript
{
  id: string,                    // Unique message ID
  role: 'user' | 'assistant',   // Who sent it
  content: string,               // Message text
  timestamp: Date,               // When sent
}
```

---

## API Request/Response (HTTP)

### Request:
```
POST /api/chat/
Content-Type: application/json

{
  "message": "Hello AI!",
  "session_id": "session_1234567890_abc123"
}
```

### Response (Success):
```
HTTP 200 OK
Content-Type: application/json

{
  "response": "Hello! I'm an AI assistant...",
  "session_id": "session_1234567890_abc123",
  "message_count": 2
}
```

### Response (Error):
```
HTTP 500 Internal Server Error
Content-Type: application/json

{
  "detail": {
    "error": "api_error",
    "message": "Failed to process message: [details]"
  }
}
```

---

## Session & Conversation Flow

```
Session Created
    ↓
User ID: "session_123456789_abcdef"
    ↓
User sends: "What is AI?"
    ↓
Backend stores: 
    {
      "session_123456789_abcdef": [
        HumanMessage("What is AI?")
      ]
    }
    ↓
Backend calls Gemini with full history
    ↓
Gemini returns response
    ↓
Backend stores:
    {
      "session_123456789_abcdef": [
        HumanMessage("What is AI?"),
        AIMessage("AI is artificial intelligence...")
      ]
    }
    ↓
User sends: "Tell me more"
    ↓
Backend calls Gemini with FULL history (both messages)
    ↓
Gemini responds with context awareness
    ↓
Continue until session cleared or server restarts
```

---

## Error Handling Flow

```
User Action (Send message)
    ↓
Frontend validates (not empty, length < 5000)
    ↓
API call initiated
    ↓
Backend validates with Pydantic
    ↓
ChatService processes
    ↓
Gemini API called
    ↓
    ├─ Success?
    │   ↓
    │   Response returned
    │   ↓
    │   Frontend: Display message
    │
    └─ Failure?
        ↓
        Catch exception
        ↓
        Structured error response
        ↓
        Frontend: Display error message
        ↓
        User can try again
```

---

## Technology Stack Visualization

```
┌────────────────────────────────────────────┐
│         Frontend (Port 5173)                │
├────────────────────────────────────────────┤
│ React 18                                   │
│   ├─ TypeScript (strict mode)             │
│   ├─ Vite (build tool)                    │
│   ├─ Tailwind CSS (styling)               │
│   ├─ Axios (HTTP client)                  │
│   └─ React Hooks (state management)       │
└────────────────────────────────────────────┘
              ↓ (HTTP/JSON)
┌────────────────────────────────────────────┐
│         Backend (Port 8000)                 │
├────────────────────────────────────────────┤
│ Python 3.11+                               │
│   ├─ FastAPI (web framework)              │
│   ├─ Pydantic (data validation)           │
│   ├─ LangChain (AI orchestration)         │
│   ├─ google-generativeai (SDK)            │
│   └─ Python-dotenv (env vars)             │
└────────────────────────────────────────────┘
              ↓ (HTTPS API)
┌────────────────────────────────────────────┐
│    Google Gemini API (Cloud)                │
├────────────────────────────────────────────┤
│ ✓ Conversation understanding               │
│ ✓ Response generation                      │
│ ✓ Context awareness                        │
│ ✓ Multi-turn dialogue                      │
└────────────────────────────────────────────┘
```

---

## Deployment Architecture (Future)

```
┌─────────────────────────────────────┐
│      Client Browser                 │
│      Any device, any location       │
└─────────────────────────────────────┘
              ↓ HTTPS
┌─────────────────────────────────────┐
│    Frontend Deployment              │
│    (Vercel, Netlify, AWS S3+CF)    │
│    - Static React build             │
│    - CDN cached                     │
│    - Auto-scaling                   │
└─────────────────────────────────────┘
              ↓ HTTPS API
┌─────────────────────────────────────┐
│    Backend Deployment               │
│    (Heroku, Railway, AWS, GCP)     │
│    - Docker containerized FastAPI   │
│    - Load balanced                  │
│    - Environment variables managed  │
│    - Logs centralized               │
└─────────────────────────────────────┘
              ↓ HTTPS API
┌─────────────────────────────────────┐
│    Google Gemini API                │
│    - Global cloud service           │
│    - Auto-scaling                   │
│    - High availability              │
└─────────────────────────────────────┘

Optional:
┌─────────────────────────────────────┐
│    PostgreSQL Database              │
│    (AWS RDS, Heroku Postgres, etc) │
│    - User data                      │
│    - Chat history persistence       │
│    - Session management             │
└─────────────────────────────────────┘
```

---

## Security Architecture

```
┌─────────────────────────────────────────────────────────┐
│ SECRETS MANAGEMENT                                      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ GOOGLE_GEMINI_API_KEY ──→ backend/.env (local)        │
│                      ──→ Environment Variable (prod)   │
│                      ──→ AWS Secrets Manager / etc      │
│                                                         │
│ NEVER:                                                  │
│   ✗ Hardcoded in source                               │
│   ✗ Committed to git                                  │
│   ✗ Exposed in frontend                               │
│   ✗ Logged in console                                 │
│                                                         │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ API SECURITY                                            │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ ✓ CORS enabled only for frontend                      │
│ ✓ Input validation with Pydantic                      │
│ ✓ Error messages don't leak internals                 │
│ ✓ No SQL injection (using ORM)                        │
│ ✓ Async to prevent thread exhaustion                  │
│                                                         │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ FRONTEND SECURITY                                       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ ✓ TypeScript prevents type errors                     │
│ ✓ Environment variables for config                    │
│ ✓ No eval() or innerHTML with user input             │
│ ✓ React sanitization built-in                        │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

**For more details, see:**
- [SETUP_GUIDE.md](SETUP_GUIDE.md) — Setup instructions
- [API_DOCS.md](API_DOCS.md) — API documentation
- [copilot-instructions.md](copilot-instructions.md) — Full specs
