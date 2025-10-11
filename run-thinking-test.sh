#!/bin/bash

# DeepSeek-R1 Thinking Test Runner
# Ensures server is running and executes the test suite

set -e

WEBAPP_DIR="/home/alpha/code/@redbtn/webapp"
cd "$WEBAPP_DIR"

echo "================================"
echo "🚀 Starting Red AI Test Suite"
echo "================================"
echo ""

# Kill any existing processes
echo "🧹 Cleaning up existing processes..."
pkill -f "next dev" 2>/dev/null || true
pkill -f "next start" 2>/dev/null || true
sleep 2

# Start the dev server
echo "🔥 Starting development server..."
npm run dev > /dev/null 2>&1 &
SERVER_PID=$!
echo "   Server PID: $SERVER_PID"
echo "   Waiting for server to be ready..."

# Wait for server to be ready (check health endpoint)
MAX_ATTEMPTS=30
ATTEMPT=0
until curl -s http://localhost:3000/api/health > /dev/null 2>&1; do
    ATTEMPT=$((ATTEMPT + 1))
    if [ $ATTEMPT -ge $MAX_ATTEMPTS ]; then
        echo "❌ Server failed to start after $MAX_ATTEMPTS attempts"
        kill $SERVER_PID 2>/dev/null || true
        exit 1
    fi
    echo -n "."
    sleep 1
done

echo ""
echo "✅ Server is ready!"
echo ""

# Run the test suite
echo "🧪 Running DeepSeek-R1 thinking tests..."
echo ""
node test-deepseek-thinking.js

# Capture test result
TEST_RESULT=$?

echo ""
echo "================================"
if [ $TEST_RESULT -eq 0 ]; then
    echo "✅ Tests completed successfully!"
else
    echo "❌ Tests failed with exit code: $TEST_RESULT"
fi
echo "================================"
echo ""
echo "💡 Server is still running (PID: $SERVER_PID)"
echo "   To stop: kill $SERVER_PID"
echo "   Or use: pkill -f 'next dev'"
echo ""

exit $TEST_RESULT
