#!/usr/bin/env bash
set -euo pipefail
root=$(cd "$(dirname "$0")/.." && pwd); cd "$root/worker"
set -a; source "$root/.env"; set +a
: "${SOKO_API_KEY:?SOKO_API_KEY is required in .env}"
forbidden_user="01a10fa2-aaf1-71da-97b6-13a0081efeb8"; worker_name="Cardano Risk Analyst"; record="$PWD/SETUP-RECORD.md"
json=$(mktemp); trap 'rm -f "$json"' EXIT
ss() { SOKOSUMI_API_KEY="$SOKO_API_KEY" sokosumi --preprod "$@"; }
identity=$(ss auth whoami --json); user_id=$(jq -r '.user.id' <<<"$identity")
test "$user_id" != "$forbidden_user" || { echo "refusing submission-1 account" >&2; exit 3; }
vendors=$(ss vendors me --json); vendor_id=$(jq -r '.vendors[] | select(.role == "admin") | .id' <<<"$vendors" | head -n1)
if [ -z "$vendor_id" ]; then
  set +e
  create_response=$(ss vendors create --name "Cardano Risk Desk" --slug "cardano-risk-desk-$(date +%s)" --json)
  set -e
  printf '%s' "$create_response" >"$json"
  vendor_id=$(jq -r '.vendor.id // .id // empty' "$json")
fi
if [ -z "$vendor_id" ] || [ "$vendor_id" = null ]; then
  mkdir -p /tmp/briefs
  printf '%s\n' 'Human step required: open Sokosumi Preprod Web, create or join an organization Workspace for account 01a10fa0-f6b4-750d-a8d5-17aea30f98d8, then rerun worker/register.sh. Vendor creation is rejected by the API until that organization Workspace exists. The Personal Workspace already exists and will be used for Coworker access and Tasks after the Vendor is created.' > /tmp/briefs/risk.human
  printf '# Account-2 setup\n\n- Account: `%s`\n- Vendor: `blocked: organization Workspace required`\n' "$user_id" >"$record"
  echo "Vendor creation requires an organization Workspace; see /tmp/briefs/risk.human" >&2
  exit 4
fi
coworkers=$(ss coworkers list --scope owned --json); coworker_id=$(jq -r --arg name "$worker_name" '.coworkers[] | select(.name == $name) | .id' <<<"$coworkers" | head -n1)
if [ -z "$coworker_id" ]; then
  coworker_id=$(ss coworkers provision --vendor-id "$vendor_id" --name "$worker_name" --caption "Evidence-backed Cardano token risk analysis" --description "Analyzes a Cardano token identifier with live chain evidence, deterministic checks, and a cited risk memo." --capability tasks --json | tee "$json" | jq -r '.coworker.id // .id')
fi
test -n "$coworker_id"; ss coworkers connect "$coworker_id" --personal --vendor-id "$vendor_id" --json >"$json"
if ! grep -q '^SOKOSUMI_COWORKER_API_KEY=' .env.local 2>/dev/null; then
  ss coworkers api-key "$coworker_id" --json >"$json"; key=$(jq -r '.apiKey.token // .token' "$json"); test -n "$key" && test "$key" != null
  umask 077; printf 'SOKOSUMI_COWORKER_ID=%s\nSOKOSUMI_COWORKER_API_KEY=%s\n' "$coworker_id" "$key" > .env.local
  printf '%s' "$key" | ss runtime key-import --coworker-id "$coworker_id" --api-key-stdin >/dev/null
fi
printf '# Account-2 setup\n\n- Account: `%s`\n- Vendor: `%s`\n- Coworker: `%s`\n- Personal access: `requested`\n- Profile: `description, caption, tasks`\n' "$user_id" "$vendor_id" "$coworker_id" >"$record"
echo "registered account=$user_id vendor=$vendor_id coworker=$coworker_id"
