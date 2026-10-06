#!/usr/bin/env bash
set -euo pipefail
root=$(cd "$(dirname "$0")/../.." && pwd); lane="$root/security/worker"; cd "$lane"
set -a; source "$root/.env"; set +a
: "${SOKO_API_KEY:?SOKO_API_KEY is required in .env}"
forbidden_user="01a10fa2-aaf1-71da-97b6-13a0081efeb8"; record="$lane/SETUP-RECORD.md"; json=$(mktemp)
trap 'rm -f "$json"' EXIT
ss() { SOKOSUMI_API_KEY="$SOKO_API_KEY" sokosumi --preprod "$@"; }
identity=$(ss auth whoami --json); user_id=$(jq -r '.user.id' <<<"$identity")
test "$user_id" != "$forbidden_user" || { echo "refusing submission-1 account" >&2; exit 3; }
vendor_id=$(rg -o 'Vendor: `[^`]+`' "$root/worker/SETUP-RECORD.md" | head -n1 | sed 's/.*`//;s/`.*//' || true)
if ! [[ "$vendor_id" =~ ^[0-9a-f-]{36}$ ]]; then
  mkdir -p /tmp/briefs
  printf '%s\n' 'Human step required: open Sokosumi Preprod Web, create or join an organization Workspace for account 01a10fa0-f6b4-750d-a8d5-17aea30f98d8, then rerun worker/register.sh and security/worker/register.sh. Vendor creation is rejected by the API until that organization Workspace exists. The Personal Workspace already exists and will be used for Coworker access and Tasks after the Vendor is created.' > /tmp/briefs/risk.human
  echo "worker Vendor is unavailable; see /tmp/briefs/risk.human" >&2
  exit 4
fi
coworkers=$(ss coworkers list --scope owned --json); coworker_id=$(jq -r '.coworkers[] | select(.name == "Aiken Security Reviewer") | .id' <<<"$coworkers" | head -n1)
if [ -z "$coworker_id" ]; then
  coworker_id=$(ss coworkers provision --vendor-id "$vendor_id" --name "Aiken Security Reviewer" --caption "Exploit-confirmed Aiken security review" --description "Reviews public Aiken repositories, confirms candidates with compiling attack tests, and returns evidence artifacts." --capability tasks --json | tee "$json" | jq -r '.coworker.id // .id')
fi
test -n "$coworker_id"; ss coworkers connect "$coworker_id" --personal --vendor-id "$vendor_id" --json >"$json"
if ! grep -q '^SOKOSUMI_COWORKER_API_KEY=' .env.local 2>/dev/null; then
  ss coworkers api-key "$coworker_id" --json >"$json"; key=$(jq -r '.apiKey.token // .token' "$json"); test -n "$key" && test "$key" != null
  umask 077; printf 'SOKOSUMI_COWORKER_ID=%s\nSOKOSUMI_COWORKER_API_KEY=%s\n' "$coworker_id" "$key" > .env.local
  printf '%s' "$key" | ss runtime key-import --coworker-id "$coworker_id" --api-key-stdin >/dev/null
fi
tasks=$(ss tasks list --personal --json)
if ! jq -e --arg id "$coworker_id" '.tasks[] | select(.coworkerId == $id and .name == "Aiken reviewer rehearsal")' <<<"$tasks" >/dev/null; then
  rehearsal=$(ss tasks create --personal --coworker-id "$coworker_id" --name "Aiken reviewer rehearsal" --description '{"repoUrl":"https://github.com/Invariant-0/cardano-ctf","path":"bank_01_deposit_vulnerability"}' --status READY --json)
  rehearsal_id=$(jq -r '.task.id // .id // empty' <<<"$rehearsal")
else
  rehearsal_id=$(jq -r --arg id "$coworker_id" '.tasks[] | select(.coworkerId == $id and .name == "Aiken reviewer rehearsal") | .id' <<<"$tasks" | head -n1)
fi
if [ ! -s worker.pid ] || ! kill -0 "$(cat worker.pid)" 2>/dev/null; then
  (set -a; source .env.local; set +a; nohup bun src/worker.ts >worker.log 2>&1 & echo $! > worker.pid)
fi
printf '# Account-2 setup\n\n- Account: `%s`\n- Vendor: `%s`\n- Coworker: `%s`\n- Personal access: `requested`\n- Profile: `description, caption, tasks`\n' "$user_id" "$vendor_id" "$coworker_id" >"$record"
printf '%s\n' "- Rehearsal Task: \`$rehearsal_id\` (READY, cardano-ctf level repo URL)" "- Worker PID: \`$(cat worker.pid)\`" >>"$record"
echo "registered account=$user_id vendor=$vendor_id coworker=$coworker_id"
