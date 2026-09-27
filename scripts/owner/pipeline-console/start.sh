#!/bin/bash
# Console locale du pipeline USDZ — avec tunnel public automatique.
# Chaque lancement ouvre aussi une URL publique pour tester en AR sur iPhone.
cd "$(dirname "$0")"

# Blender : variable d'env ou PATH
if [ -z "$BLENDER_BIN" ] && ! command -v blender >/dev/null 2>&1; then
  echo "Attention : Blender introuvable (ni BLENDER_BIN, ni dans le PATH)."
  echo "La console démarre quand même, mais la génération des variantes échouera."
  echo ""
fi

PORT="${CONSOLE_PORT:-$(python3 -c "import json;print(json.load(open('config.json'))['port'])" 2>/dev/null || echo 8130)}"

# 1) console locale
node server.mjs > console.log 2>&1 &
SERVER_PID=$!
LT_PID=""
cleanup() {
  [ -n "$SERVER_PID" ] && kill "$SERVER_PID" 2>/dev/null
  [ -n "$LT_PID" ] && kill "$LT_PID" 2>/dev/null
}
# Installé dès le premier enfant : un Ctrl+C pendant l'attente du token ou
# du tunnel (fenêtre d'environ une minute) arrête aussi le serveur et le
# tunnel, y compris en sortie normale du script.
trap cleanup INT TERM EXIT
sleep 2
if ! kill -0 $SERVER_PID 2>/dev/null; then
  echo "La console n'a pas démarré. Voir console.log"
  exit 1
fi

# Token d'accès (généré par server.mjs, exigé par l'UI et l'API).
# On lit toute la ligne TOKEN= : CONSOLE_TOKEN peut contenir des caractères
# non hexadécimaux, que le serveur accepte tels quels.
TOKEN=""
for i in $(seq 1 10); do
  TOKEN=$(grep -o 'TOKEN=.*' console.log | head -1 | cut -d= -f2-)
  [ -n "$TOKEN" ] && break
  sleep 1
done
if [ -z "$TOKEN" ]; then
  echo "Token introuvable dans console.log"
  exit 1
fi
# Le token voyage dans l'URL : on l'encode pour les liens affichés
# (le serveur le décode via URLSearchParams).
TOKEN_URL=$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe=''))" "$TOKEN")

# 2) tunnel public automatique (pour tester en AR sur iPhone)
echo "Ouverture du tunnel public..."
npx --yes localtunnel --port "$PORT" > tunnel.log 2>&1 &
LT_PID=$!

URL=""
for i in $(seq 1 30); do
  URL=$(grep -o 'https://[^ ]*\.loca\.lt' tunnel.log | head -1)
  [ -n "$URL" ] && break
  sleep 2
done

echo ""
echo "=================================="
echo " Console : http://127.0.0.1:$PORT/?token=$TOKEN_URL"
if [ -n "$URL" ]; then
  echo " iPhone  : $URL/?token=$TOKEN_URL"
  echo ""
  echo " (1re visite : entre ton IP publique si localtunnel la demande)"
else
  echo " Tunnel : échec, voir tunnel.log"
fi
echo "=================================="
echo "Ctrl+C pour tout arrêter."
echo ""

wait $SERVER_PID
