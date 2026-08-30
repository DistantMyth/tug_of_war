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

# 3. Determine local IPv4 and global IPv6 address
LOCAL_IP=$(ip route get 1.1.1.1 2>/dev/null | awk '{print $7}' | head -n 1)
if [ -z "$LOCAL_IP" ]; then
  LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
fi
if [ -z "$LOCAL_IP" ]; then
  LOCAL_IP="localhost"
fi

IPV6_ADDR=$(ip -6 addr show scope global 2>/dev/null | grep inet6 | awk '{print $2}' | cut -d'/' -f1 | head -n 1 || true)

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

# 4. Routing Options
# Modes:
#   --local / --localroute / --lan (Default): Ultra-low 0ms latency LAN / Wi-Fi Hotspot
#   --localtunnel / --lt: Localtunnel public HTTP/WebSocket proxy
#   --pinggy / --ssh: Instant high-speed SSH reverse tunnel
#   --tunnel / --cloudflare / -t: Cloudflare quick tunnel

MODE="local"
TUNNEL_URL=""

for arg in "$@"; do
  case $arg in
    --local|--localroute|--lan|-l)
      MODE="local"
      ;;
    --tunnel|--cloudflare|-t)
      MODE="cloudflare"
      ;;
    --localtunnel|--lt)
      MODE="localtunnel"
      ;;
    --pinggy|--ssh)
      MODE="pinggy"
      ;;
    --help|-h)
      echo "Usage: ./start.sh [OPTION]"
      echo ""
      echo "Options:"
      echo "  --local, --localroute, --lan  (Default) 0ms latency direct LAN / Wi-Fi Hotspot"
      echo "  --localtunnel, --lt           Localtunnel public proxy"
      echo "  --pinggy, --ssh               Pinggy low-latency SSH tunnel"
      echo "  --tunnel, --cloudflare, -t    Cloudflare quick tunnel"
      echo "  --help, -h                    Show this help message"
      echo ""
      exit 0
      ;;
  esac
done

if [ "$MODE" == "cloudflare" ]; then
  if [ -n "$CLOUDFLARED_BIN" ]; then
    echo "🌐 Starting high-capacity Cloudflare tunnel..."
    rm -f /tmp/tow_cloudflared.log
    $CLOUDFLARED_BIN tunnel --url "http://localhost:$PORT" > /tmp/tow_cloudflared.log 2>&1 &
    TUNNEL_PID=$!

    # Poll for the assigned trycloudflare.com URL
    for i in {1..30}; do
      if [ -f /tmp/tow_cloudflared.log ]; then
        TUNNEL_URL=$(grep -oE 'https://[a-zA-Z0-9-]+\.trycloudflare\.com' /tmp/tow_cloudflared.log | head -n 1 || true)
        if [ -n "$TUNNEL_URL" ]; then
          break
        fi
      fi
      sleep 0.5
    done
  fi
elif [ "$MODE" == "localtunnel" ]; then
  echo "🌐 Starting Localtunnel (https://localtunnel.me)..."
  rm -f /tmp/tow_lt.log
  npx --yes localtunnel --port "$PORT" > /tmp/tow_lt.log 2>&1 &
  TUNNEL_PID=$!
  for i in {1..20}; do
    if [ -f /tmp/tow_lt.log ]; then
      TUNNEL_URL=$(grep -oE 'https://[a-zA-Z0-9-]+\.loca\.lt' /tmp/tow_lt.log | head -n 1 || true)
      if [ -n "$TUNNEL_URL" ]; then
        break
      fi
    fi
    sleep 0.5
  done
elif [ "$MODE" == "pinggy" ]; then
  echo "🌐 Starting Pinggy SSH Low-Latency Tunnel..."
  rm -f /tmp/tow_pinggy.log
  ssh -p 443 -R0:localhost:$PORT -o StrictHostKeyChecking=no -o ServerAliveInterval=30 a.pinggy.io > /tmp/tow_pinggy.log 2>&1 &
  TUNNEL_PID=$!
  for i in {1..20}; do
    if [ -f /tmp/tow_pinggy.log ]; then
      TUNNEL_URL=$(grep -oE 'https://[a-zA-Z0-9-]+\.a\.pinggy\.link' /tmp/tow_pinggy.log | head -n 1 || true)
      if [ -n "$TUNNEL_URL" ]; then
        break
      fi
    fi
    sleep 0.5
  done
fi

if [ -n "$TUNNEL_URL" ]; then
  export PUBLIC_URL="$TUNNEL_URL"
  echo ""
  echo "================================================================="
  echo "  🌟 PUBLIC INTERNET READY (MODE: $MODE)"
  echo "================================================================="
  echo "  📺 Projector / Display:   $TUNNEL_URL/display"
  echo "  🛡️  Admin Dashboard:      $TUNNEL_URL/admin"
  echo "  📱 Mobile Join Page:      $TUNNEL_URL/join"
  echo "  🔌 Health Check:          $TUNNEL_URL/health"
  echo "================================================================="
  echo ""
fi

# 5. Start Backend Server
echo "⚡ Starting backend server on port $PORT..."
pnpm --filter @tow/server start &
SERVER_PID=$!

sleep 2

if [ -z "$TUNNEL_URL" ]; then
  echo ""
  echo "================================================================="
  echo "  ⚡ LOCALROUTE (0ms ULTRA-LOW LATENCY LAN / WI-FI HOTSPOT)"
  echo "================================================================="
  echo "  📺 Projector / Display:   http://$LOCAL_IP:$PORT/display"
  echo "  🛡️  Admin Dashboard:      http://localhost:$PORT/admin"
  echo "  📱 Mobile Join (Hotspot): http://$LOCAL_IP:$PORT/join"
  if [ -n "$IPV6_ADDR" ]; then
    echo "  🌐 Mobile Join (IPv6):    http://[$IPV6_ADDR]:$PORT/join"
  fi
  echo "  🔌 Health Check:          http://localhost:$PORT/health"
  echo "================================================================="
  echo ""
  echo "💡 Direct Cellular & Wi-Fi Access:"
  echo "   - On Same Wi-Fi / Hotspot: http://$LOCAL_IP:$PORT/join"
  if [ -n "$IPV6_ADDR" ]; then
    echo "   - Over 4G/5G Cellular (via rooted phone IPv6): http://[$IPV6_ADDR]:$PORT/join"
  fi
fi

echo ""
echo "🎉 Server is live! Press [Ctrl + C] to stop."
echo ""

# Keep running
wait $SERVER_PID
