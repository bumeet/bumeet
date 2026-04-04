#!/bin/bash
# BUMEET Platform — start all services

set -e

export NVM_DIR="$HOME/.nvm"
source "$NVM_DIR/nvm.sh"
nvm use 20

cd "$(dirname "$0")"

echo "🐳 Starting Docker services..."
docker compose up -d
echo "✅ Postgres + Redis running"

echo "🚀 Starting API (port 3001)..."
cd apps/api
npx nest start &
API_PID=$!
cd ../..

echo "⏳ Waiting for API..."
sleep 18

echo "🌐 Starting Web (port 3000)..."
cd apps/web
npx next dev -p 3000 &
WEB_PID=$!
cd ../..

echo ""
echo "✅ BUMEET running!"
echo "   Frontend → http://localhost:3000"
echo "   API      → http://localhost:3001/api/v1"
echo ""
echo "Press Ctrl+C to stop all services"

trap "kill $API_PID $WEB_PID 2>/dev/null; docker compose stop" EXIT
wait
