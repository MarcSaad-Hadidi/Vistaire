#!/usr/bin/env bash
# Un groupe par service permet aussi d’arrêter les enfants de npx.
set -eu
set -m
umask 077
cd "$(dirname "$0")"

PORT="${CONSOLE_PORT:-$(node -p "require('./config.json').port || 8130")}"
HOST="${CONSOLE_HOST:-$(node -p "require('./config.json').host || '127.0.0.1'")}"
LOCAL_HOST="$HOST"
case "$LOCAL_HOST" in 0.0.0.0|::) LOCAL_HOST=127.0.0.1 ;; esac
URL_HOST="$LOCAL_HOST"
case "$URL_HOST" in *:*) URL_HOST="[$URL_HOST]" ;; esac
SERVER_PID=""
LT_PID=""
cleanup() {
  trap - EXIT
  if [ -n "$LT_PID" ]; then
    kill -- "-$LT_PID" 2>/dev/null || true
    wait "$LT_PID" 2>/dev/null || true
  fi
  if [ -n "$SERVER_PID" ]; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

node server.mjs > console.log 2>&1 &
SERVER_PID=$!
TOKEN_URL=""
for ((i=0; i<20; i++)); do
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    echo "La console n’a pas démarré. Voir console.log"
    exit 1
  fi
  TOKEN_URL=$(node -e 'const fs=require("fs"); const m=fs.readFileSync("console.log","utf8").match(/^TOKEN=(.*)$/m); if(m) process.stdout.write(encodeURIComponent(m[1]));')
  [ -n "$TOKEN_URL" ] && break
  sleep 1
done
if [ -z "$TOKEN_URL" ]; then
  echo "Token introuvable dans console.log"
  exit 1
fi

echo "Console : http://$URL_HOST:$PORT/?token=$TOKEN_URL"
if [ "${CONSOLE_NO_TUNNEL:-0}" != "1" ]; then
  echo "Ouverture du tunnel public (l’URL contient votre accès privé)..."
  npx --yes localtunnel@2.0.2 --port "$PORT" --local-host "$LOCAL_HOST" > tunnel.log 2>&1 &
  LT_PID=$!
  URL=""
  for ((i=0; i<30; i++)); do
    URL=$(node -e 'const fs=require("fs"); const m=fs.readFileSync("tunnel.log","utf8").match(/https:\/\/[a-z0-9-]+\.loca\.lt/); if(m) process.stdout.write(m[0]);')
    [ -n "$URL" ] && break
    kill -0 "$SERVER_PID" 2>/dev/null || exit 1
    kill -0 "$LT_PID" 2>/dev/null || break
    sleep 2
  done
  if [ -n "$URL" ]; then
    echo "iPhone : $URL/?token=$TOKEN_URL"
    echo "Première visite : localtunnel peut demander votre IP publique."
  else
    echo "Tunnel indisponible : voir tunnel.log. La console locale reste accessible."
  fi
fi
echo "Ctrl+C pour tout arrêter."
wait "$SERVER_PID"
