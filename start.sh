#!/usr/bin/env bash

# ==============================================================================
# Tug of War: Unified Local & Public Server Launcher
# ==============================================================================

set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$DIR"

PORT=${PORT:-3001}

echo ""
echo "================================================================="
echo "  🚀 TUG OF WAR — HIGH-PERFORMANCE LAPTOP SERVER LAUNCHER"
echo "================================================================="
echo ""

# 1. Clean up any existing process on port $PORT
EXISTING_PID=$(lsof -ti:$PORT 2>/dev/null || true)
if [ -n "$EXISTING_PID" ]; then
  echo "🧹 Freeing port $PORT from previous process (PID: $EXISTING_PID)..."
  kill -9 $EXISTING_PID 2>/dev/null || true
  sleep 1
fi

# 2. Build frontend production bundle if not present
if [ ! -f "apps/web/dist/index.html" ]; then
  echo "📦 Building optimized production frontend..."
  pnpm build
else
  echo "✓ Found existing build in apps/web/dist"
fi

# 3. Determine local IP address
LOCAL_IP=$(ip route get 1.1.1.1 2>/dev/null | awk '{print $7}' | head -n 1)
if [ -z "$LOCAL_IP" ]; then
  LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
fi
if [ -z "$LOCAL_IP" ]; then
  LOCAL_IP="localhost"
fi

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
  rm -f /tmp/tow_cloudflared.log 2>/dev/null || true
  exit 0
}
trap cleanup SIGINT SIGTERM EXIT

# 4. Optional Public Tunnel using Cloudflare (No account, native WebSockets, 200+ capacity)
CLOUDFLARED_BIN=""
if [ -x "./bin/cloudflared" ]; then
  CLOUDFLARED_BIN="./bin/cloudflared"
elif command -v cloudflared &> /dev/null; then
  CLOUDFLARED_BIN="cloudflared"
fi

if [ "$1" == "--tunnel" ] || [ "$1" == "-t" ]; then
  if [ -n "$CLOUDFLARED_BIN" ]; then
    echo "🌐 Starting high-capacity Cloudflare tunnel..."
    rm -f /tmp/tow_cloudflared.log
    $CLOUDFLARED_BIN tunnel --url "http://localhost:$PORT" > /tmp/tow_cloudflared.log 2>&1 &
    TUNNEL_PID=$!

    # Poll for the assigned trycloudflare.com URL
    TUNNEL_URL=""
    for i in {1..30}; do
      if [ -f /tmp/tow_cloudflared.log ]; then
        TUNNEL_URL=$(grep -oE 'https://[a-zA-Z0-9-]+\.trycloudflare\.com' /tmp/tow_cloudflared.log | head -n 1 || true)
        if [ -n "$TUNNEL_URL" ]; then
          break
        fi
      fi
      sleep 0.5
    done

    if [ -n "$TUNNEL_URL" ]; then
      export PUBLIC_URL="$TUNNEL_URL"
      echo ""
      echo "================================================================="
      echo "  🌟 PUBLIC INTERNET READY (200+ PLAYERS ON 4G/5G/CELLULAR)"
      echo "================================================================="
      echo "  📺 Projector / Display:   $TUNNEL_URL/display"
      echo "  🛡️  Admin Dashboard:      $TUNNEL_URL/admin"
      echo "  📱 Mobile Join Page:      $TUNNEL_URL/join"
      echo "  🔌 Health Check:          $TUNNEL_URL/health"
      echo "================================================================="
      echo ""
    fi
  else
    echo "🌐 Starting localtunnel..."
    npx --yes localtunnel --port "$PORT" &
    TUNNEL_PID=$!
  fi
fi

# 5. Start Backend Server
echo "⚡ Starting backend server on port $PORT..."
pnpm --filter @tow/server start &
SERVER_PID=$!

sleep 2

if [ -z "$TUNNEL_URL" ]; then
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
  echo "💡 Tip: To expose to mobile 4G/5G players outside local Wi-Fi, run:"
  echo "        ./start.sh --tunnel"
fi

echo ""
echo "🎉 Server is live! Press [Ctrl + C] to stop."
echo ""

# Keep running
wait $SERVER_PID
