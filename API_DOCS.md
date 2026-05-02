# Backend API Documentation

## Overview

The backend is a FastAPI application that provides a chat API powered by Google Gemini. All endpoints are under the `/api` prefix.

---

## Base URL

```
http://localhost:8000
```

## Endpoints

### 1. Health Check

**Endpoint:** `GET /health`

**Description:** Check if the backend is running and healthy.

**Response:**
```json
{
  "status": "ok"
}
```

**cURL Example:**
```bash
curl http://localhost:8000/health
```

---

### 2. Chat (Main Endpoint)

**Endpoint:** `POST /api/chat/`

**Description:** Send a message and get a response from Google Gemini.

**Request Body:**
```json
{
  "message": "What is machine learning?",
  "session_id": "session_123456"
}
```

**Request Fields:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `message` | string | Yes | User message (1-5000 characters) |
| `session_id` | string | Yes | Unique identifier for the conversation session |

**Response (Success - 200):**
```json
{
  "response": "Machine learning is a subset of artificial intelligence...",
  "session_id": "session_123456",
  "message_count": 2
}
```

**Response (Error - 500):**
```json
{
  "detail": {
    "error": "api_error",
    "message": "Failed to process message: [error details]"
  }
}
```

**cURL Example:**
```bash
curl -X POST http://localhost:8000/api/chat/ \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello!", "session_id": "session_123"}'
```

**Python Requests Example:**
```python
import requests

response = requests.post(
    'http://localhost:8000/api/chat/',
    json={
        'message': 'What is AI?',
        'session_id': 'session_123'
    }
)

print(response.json()['response'])
```

---

### 3. Get Session Info

**Endpoint:** `GET /api/chat/sessions/{session_id}/info`

**Description:** Get information about a chat session (message count, etc.).

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `session_id` | string | Session identifier |

**Response (Success - 200):**
```json
{
  "session_id": "session_123456",
  "message_count": 5,
  "has_messages": true
}
```

**cURL Example:**
```bash
curl http://localhost:8000/api/chat/sessions/session_123/info
```

---

### 4. Clear Session

**Endpoint:** `DELETE /api/chat/sessions/{session_id}`

**Description:** Clear conversation history for a session.

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `session_id` | string | Session identifier |

**Response (Success - 200):**
```json
{
  "message": "Session session_123456 cleared"
}
```

**cURL Example:**
```bash
curl -X DELETE http://localhost:8000/api/chat/sessions/session_123
```

---

## Error Handling

All errors are returned with proper HTTP status codes and detailed error messages.

### Common Error Codes

| Status | Error Type | Meaning |
|--------|-----------|---------|
| 422 | Validation Error | Invalid request parameters (missing required fields, wrong types) |
| 500 | Configuration Error | Missing `GOOGLE_GEMINI_API_KEY` environment variable |
| 500 | API Error | Failed to call Google Gemini API |

### Example Error Response

```json
{
  "detail": {
    "error": "api_error",
    "message": "Failed to process message: Connection timeout"
  }
}
```

---

## Architecture & Flow

### Request Flow

```
Frontend
   ↓
[POST /api/chat/]
   ↓
FastAPI Route Handler (app/api/chat.py)
   ↓
ChatService (app/services/chat_service.py)
   ↓
LangChain + Google Gemini
   ↓
Store in-memory conversation history
   ↓
Return response to frontend
```

### Session Management

- Each conversation has a unique `session_id`
- Frontend generates session ID on mount: `session_{timestamp}_{random}`
- Backend maintains in-memory history per session
- History is lost if server restarts (upgrade to database storage in production)

### Conversation History

When a message is sent:
1. User message is added to conversation history
2. LangChain chain is invoked with full history
3. AI generates response
4. Response is added to history
5. Only the response is returned to frontend

---

## Configuration

### Required Environment Variables

```env
GOOGLE_GEMINI_API_KEY=your-api-key-here
GEMINI_MODEL=gemini-pro
```

### Optional Configuration

```env
DEBUG=True                                    # Enable debug mode
LOG_LEVEL=INFO                               # Logging level
CORS_ORIGINS=["http://localhost:5173", ...]  # CORS allowed origins
```

---

## Testing with Postman/Insomnia

1. **Import into Postman:**
   - Method: `POST`
   - URL: `http://localhost:8000/api/chat/`
   - Headers: `Content-Type: application/json`
   - Body (JSON):
     ```json
     {
       "message": "Hello, how are you?",
       "session_id": "test_session_1"
     }
     ```

2. **Send the request and check the response**

---

## Performance Considerations

- **First call** per session: Slower (model loading)
- **Subsequent calls**: Faster (model already loaded)
- **Conversation history**: Grows with each message (consider pagination)
- **In-memory storage**: Not suitable for production (use database)

---

## Future Enhancements

- [ ] Database persistence for conversation history
- [ ] User authentication (JWT)
- [ ] Rate limiting
- [ ] Streaming responses (Server-Sent Events)
- [ ] Typing status indicators
- [ ] Message editing/deletion
- [ ] Multi-user sessions
- [ ] Analytics and logging

---

## Quick Testing Script

Create `test_api.py`:

```python
import requests
import json

BASE_URL = "http://localhost:8000"
SESSION_ID = "test_session_123"

def test_health():
    response = requests.get(f"{BASE_URL}/health")
    print("Health Check:", response.json())

def test_chat(message):
    payload = {
        "message": message,
        "session_id": SESSION_ID
    }
    response = requests.post(f"{BASE_URL}/api/chat/", json=payload)
    if response.status_code == 200:
        data = response.json()
        print(f"\nUser: {message}")
        print(f"Bot: {data['response']}")
        print(f"Message count: {data['message_count']}")
    else:
        print(f"Error: {response.json()}")

def test_session_info():
    response = requests.get(f"{BASE_URL}/api/chat/sessions/{SESSION_ID}/info")
    print("\nSession Info:", response.json())

if __name__ == "__main__":
    test_health()
    test_chat("Hello, what can you do?")
    test_chat("Tell me about Python")
    test_session_info()
```

Run with:
```bash
python test_api.py
```

---

**For more information, see [SETUP_GUIDE.md](SETUP_GUIDE.md)**
