#!/bin/bash

echo "Starting DeepSeek Gomoku AI Integration..."
echo ""

echo "[1/2] Starting Flask backend server..."
cd server
python app.py &
BACKEND_PID=$!
cd ..
echo "Backend server starting at http://localhost:5000 (PID: $BACKEND_PID)"
echo ""

echo "[2/2] Starting frontend..."
echo "Please open index.html in your browser or use a static file server."
echo "Example: python -m http.server 8000"
echo ""

echo "Press Ctrl+C to stop the backend server..."
wait $BACKEND_PID