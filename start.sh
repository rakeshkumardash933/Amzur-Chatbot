#!/bin/bash
# Quick start script for Amzur Chatbot
# Starts both frontend and backend servers

echo "🚀 Starting Amzur Chatbot..."

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Start backend
echo -e "${BLUE}Starting backend...${NC}"
cd backend
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python -m venv venv
fi

source venv/bin/activate
pip install -q -r requirements.txt

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "Creating .env from template..."
    cp .env.example .env
    echo -e "${GREEN}✓ .env created. Please edit it with your API key!${NC}"
fi

echo -e "${GREEN}✓ Backend dependencies installed${NC}"
python main.py &
BACKEND_PID=$!

cd ..

# Start frontend
echo -e "${BLUE}Starting frontend...${NC}"
cd frontend
npm install -q

if [ ! -f ".env" ]; then
    echo "Creating .env from template..."
    cp .env.example .env
fi

npm run dev &
FRONTEND_PID=$!

cd ..

echo ""
echo -e "${GREEN}✓ Both servers starting...${NC}"
echo ""
echo "📱 Frontend: http://localhost:5173"
echo "🔧 Backend:  http://localhost:8000"
echo ""
echo "Press Ctrl+C to stop both servers"

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID
