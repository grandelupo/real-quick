#!/usr/bin/env bash
# Deploy the gateway to the Hetzner VPS (app-builder/BACKEND.md Phase 1b box).
#
#   ./deploy.sh          code + service + Caddy route, idempotent
#   ./deploy.sh --key    also (re)writes /etc/realquick/gateway.env with the
#                        model key from app-builder/apps/realquick.env or app-builder/.env
#
# Reads VPS_SERVER_IPV4 / VPS_SERVER_USER / VPS_SERVER_SSH_KEY from app-builder/.env.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
AB="${APP_BUILDER:-$HERE/../../app-builder}"
envval() { # read KEY from a dotenv file without sourcing it (values contain shell metacharacters)
  python3 - "$1" "$2" <<'PY'
import sys
path, key = sys.argv[1], sys.argv[2]
try:
    for line in open(path):
        line = line.strip()
        if line.startswith(key + "="):
            v = line.split("=", 1)[1].strip()
            if len(v) > 1 and v[0] == v[-1] and v[0] in "\"'": v = v[1:-1]
            print(v); break
except FileNotFoundError:
    pass
PY
}
HOST=$(envval "$AB/.env" VPS_SERVER_IPV4); USER_=$(envval "$AB/.env" VPS_SERVER_USER); KEY=$(envval "$AB/.env" VPS_SERVER_SSH_KEY)
[ -n "$HOST" ] || { echo "VPS_SERVER_IPV4 missing in $AB/.env"; exit 1; }
SSH="ssh -i ${KEY/#\~/$HOME} -o StrictHostKeyChecking=accept-new ${USER_:-root}@$HOST"

$SSH 'ss -tlnp | grep -q ":8099 " && ! systemctl is-active --quiet realquick-gateway && { echo "port 8099 taken — pick another (BACKEND.md port registry)"; exit 1; } || true'
$SSH 'id realquick >/dev/null 2>&1 || useradd --system --home /opt/realquick --shell /usr/sbin/nologin realquick
      mkdir -p /opt/realquick /var/lib/realquick /etc/realquick /srv/sites/realquick
      chown realquick:realquick /var/lib/realquick
      [ -d /opt/realquick/venv ] || python3 -m venv /opt/realquick/venv
      /opt/realquick/venv/bin/pip install -q --upgrade "anthropic>=2,<3" "cryptography>=43"'
scp -i "${KEY/#\~/$HOME}" "$HERE/gateway.py" "$HERE/AppleRootCA-G3.cer" "${USER_:-root}@$HOST:/opt/realquick/"
scp -i "${KEY/#\~/$HOME}" "$HERE/deploy/realquick-gateway.service" "${USER_:-root}@$HOST:/etc/systemd/system/"

if [ "${1:-}" = "--key" ]; then
  AK=$(envval "$AB/apps/realquick.env" ANTHROPIC_API_KEY); [ -n "$AK" ] || AK=$(envval "$AB/.env" ANTHROPIC_API_KEY)
  PK=$(envval "$AB/apps/realquick.env" PERPLEXITY_API_KEY); [ -n "$PK" ] || PK=$(envval "$AB/.env" PERPLEXITY_API_KEY)
  sed -e "s|^ANTHROPIC_API_KEY=.*|ANTHROPIC_API_KEY=$AK|" -e "s|^PERPLEXITY_API_KEY=.*|PERPLEXITY_API_KEY=$PK|" "$HERE/deploy/realquick.env.example" \
    | $SSH 'umask 077; cat > /etc/realquick/gateway.env; chown root:realquick /etc/realquick/gateway.env; chmod 640 /etc/realquick/gateway.env'
fi
$SSH 'test -f /etc/realquick/gateway.env || { echo "no /etc/realquick/gateway.env — run ./deploy.sh --key"; exit 1; }'

# Caddy: append the site block once; pre-create its log file (BACKEND.md trap).
$SSH 'grep -q "realquick.lab.karolkrakowski.pl" /etc/caddy/Caddyfile' || cat "$HERE/deploy/Caddyfile.snippet" | $SSH 'cat >> /etc/caddy/Caddyfile'
$SSH 'install -o caddy -g caddy -m 644 /dev/null /var/log/caddy/realquick.log 2>/dev/null || true
      systemctl daemon-reload && systemctl enable --now realquick-gateway && systemctl restart realquick-gateway
      caddy validate --config /etc/caddy/Caddyfile >/dev/null && systemctl reload caddy'
sleep 2
curl -fsS https://realquick.lab.karolkrakowski.pl/healthz && echo
