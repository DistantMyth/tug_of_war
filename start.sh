#!/usr/bin/env bash

# ==============================================================================
# Tug of War: Unified Local & Public Server Launcher
# ==============================================================================

set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$DIR"

echo ""
echo "================================================================="
echo "  🚀 TUG OF WAR — HIGH-PERFORMANCE LAPTOP SERVER LAUNCHER"
echo "================================================================="
echo ""

# 1. Build frontend production bundle if not present
if [ ! -f "apps/web/dist/index.html" ]; then
  echo "📦 Building optimized production frontend..."
  pnpm build
else
  echo "✓ Found existing build in apps/web/dist"
fi

# 2. Determine local IP address
LOCAL_IP=$(ip route get 1.1.1.1 2>/dev/null | awk '{print $7}' | head -n 1)
if [ -z "$LOCAL_IP" ]; then
  LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
fi
if [ -z "$LOCAL_IP" ]; then
  LOCAL_IP="localhost"
fi

PORT=${PORT:-3001}

echo ""
echo "-----------------------------------------------------------------"
echo "  💻 LOCAL SERVER READY"
echo "-----------------------------------------------------------------"
echo "  📺 Projector / Display:   http://$LOCAL_IP:$PORT/display"
echo "  🛡️  Admin Dashboard:      http://localhost:$PORT/admin"
echo "  📱 Mobile Join Page:      http://$LOCAL_IP:$PORT/join"
echo "  🔌 Health Check:          http://localhost:$PORT/health"
echo "-----------------------------------------------------------------"
echo ""

# Handle clean shutdown on Ctrl+C / SIGTERM
cleanup() {
  echo ""
  echo "🛑 Stopping Tug of War server..."
  if [ -n "$SERVER_PID" ]; then
    kill "$SERVER_PID" 2>/dev/null || true
  fi
  if [ -n "$TUNNEL_PID" ]; then
    kill "$TUNNEL_PID" 2>/dev/null || true
  fi
  exit 0
}
trap cleanup SIGINT SIGTERM EXIT

# 3. Start Backend Server
echo "⚡ Starting backend server on port $PORT..."
pnpm --filter @tow/server start &
SERVER_PID=$!

# Wait briefly for server to bind
sleep 2

# 4. Optional Public Tunnel (for cellular/mobile players outside local Wi-Fi)
if [ "$1" == "--tunnel" ] || [ "$1" == "-t" ]; then
  echo ""
  echo "🌐 Starting public internet tunnel for mobile players..."
  if command -v cloudflared &> /dev/null; then
    cloudflared tunnel --url "http://localhost:$PORT" &
    TUNNEL_PID=$!
  else
    npx --yes localtunnel --port "$PORT" &
    TUNNEL_PID=$!
  fi
else
  echo "💡 Tip: To expose to public mobile data (4G/5G), run: ./start.sh --tunnel"
fi

echo ""
echo "🎉 Server is running! Press [Ctrl + C] to stop."
echo ""

# Keep running
wait $SERVER_PID
