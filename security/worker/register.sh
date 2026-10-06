#!/usr/bin/env bash
set -euo pipefail
root=$(cd "$(dirname "$0")/../.." && pwd); lane="$root/security/worker"; cd "$lane"
set -a; source "$root/.env"; set +a
: "${SOKO_API_KEY:?SOKO_API_KEY is required in .env}"
forbidden_user="01a10fa2-aaf1-71da-97b6-13a0081efeb8"; organization_id="01a1107a-bcf2-73a9-9d62-d71cef4decee"; organization_slug="cardano-risk-coworker-kwrv88"; record="$lane/SETUP-RECORD.md"; json=$(mktemp)
trap 'rm -f "$json"' EXIT
ss() { SOKOSUMI_API_KEY="$SOKO_API_KEY" sokosumi --preprod "$@"; }
identity=$(ss auth whoami --json); user_id=$(jq -r '.user.id' <<<"$identity")
test "$user_id" != "$forbidden_user" || { echo "refusing submission-1 account" >&2; exit 3; }
vendor_id=$(ss vendors me --json | jq -r '.vendors[] | select(.role == "admin") | .id' | head -n1)
if ! [[ "$vendor_id" =~ ^[0-9a-f-]{36}$ ]]; then
  mkdir -p /tmp/briefs
  printf '%s\n' 'Human step required: open Sokosumi Preprod Web, create or join an organization Workspace for account 01a10fa0-f6b4-750d-a8d5-17aea30f98d8, then rerun worker/register.sh and security/worker/register.sh. Vendor creation is rejected by the API until that organization Workspace exists. The Personal Workspace already exists and will be used for Coworker access and Tasks after the Vendor is created.' > /tmp/briefs/risk.human
  echo "worker Vendor is unavailable; see /tmp/briefs/risk.human" >&2
  exit 4
fi
coworkers=$(ss coworkers list --scope owned --json); coworker_id=$(jq -r --arg vendor "$vendor_id" '.coworkers[] | select(.name == "Aiken Security Reviewer" and .vendor.id == $vendor) | .id' <<<"$coworkers" | head -n1)
if [ -z "$coworker_id" ]; then
  coworker_id=$(ss coworkers provision --vendor-id "$vendor_id" --name "Aiken Security Reviewer $(date +%s)" --caption "Exploit-confirmed Aiken security review" --description "Reviews public Aiken repositories, confirms candidates with compiling attack tests, and returns evidence artifacts." --capability tasks --json | tee "$json" | jq -r '.coworker.id // .id')
fi
test -n "$coworker_id"; ss coworkers connect "$coworker_id" --personal --vendor-id "$vendor_id" --json >"$json"
ss coworkers connect "$coworker_id" --vendor-id "$vendor_id" --workspace-id "$organization_id" --json >"$json"
ss coworkers update "$coworker_id" --name "Aiken Security Reviewer" --description "Reviews public Aiken repositories, confirms candidates with compiling attack tests, and returns evidence artifacts." --json >"$json"
if ! grep -q "^SOKOSUMI_COWORKER_ID=$coworker_id$" .env.local 2>/dev/null; then
  ss coworkers api-key "$coworker_id" --json >"$json"; key=$(jq -r '.apiKey.token // .token' "$json"); test -n "$key" && test "$key" != null
  umask 077; printf 'SOKOSUMI_API_URL=https://api.preprod.sokosumi.com/v1\nSOKOSUMI_COWORKER_ID=%s\nSOKOSUMI_COWORKER_API_KEY=%s\n' "$coworker_id" "$key" > .env.local
  printf '%s' "$key" | ss runtime key-import --coworker-id "$coworker_id" --api-key-stdin >/dev/null
fi
org_tasks=$(ss tasks list --organization-slug "$organization_slug" --json)
if ! jq -e --arg id "$coworker_id" '.tasks[] | select(.coworkerId == $id and .name == "Aiken reviewer rehearsal")' <<<"$org_tasks" >/dev/null; then
  org_rehearsal=$(ss tasks create --organization-slug "$organization_slug" --coworker-id "$coworker_id" --name "Aiken reviewer rehearsal" --description '{"repoUrl":"https://github.com/Invariant-0/cardano-ctf","path":"bank_01_deposit_vulnerability"}' --status READY --json)
  org_rehearsal_id=$(jq -r '.task.id // .id // empty' <<<"$org_rehearsal")
else
  org_rehearsal_id=$(jq -r --arg id "$coworker_id" '.tasks[] | select(.coworkerId == $id and .name == "Aiken reviewer rehearsal") | .id' <<<"$org_tasks" | head -n1)
fi
rehearsal=$(ss tasks create --personal --coworker-id "$coworker_id" --name "Aiken reviewer rehearsal" --description '{"repoUrl":"https://github.com/Invariant-0/cardano-ctf","path":"bank_01_deposit_vulnerability"}' --status READY --json)
rehearsal_id=$(jq -r '.task.id // .id // empty' <<<"$rehearsal")
if [ ! -s worker.pid ] || ! kill -0 "$(cat worker.pid)" 2>/dev/null; then
  (set -a; source .env.local; set +a; export SOKOSUMI_API_KEY="$SOKO_API_KEY"; nohup bun src/worker.ts >worker.log 2>&1 & echo $! > worker.pid)
fi
printf '# Account-2 setup\n\n- Account: `%s`\n- Vendor: `%s`\n- Organization: `%s` (`%s`)\n- Coworker: `%s`\n- Personal access: `requested`\n- Organization access: `requested`\n- Profile: `description, caption, tasks`\n' "$user_id" "$vendor_id" "$organization_id" "$organization_slug" "$coworker_id" >"$record"
printf '%s\n' "- Personal rehearsal Task: \`$rehearsal_id\` (READY, cardano-ctf level repo URL)" "- Organization rehearsal Task: \`$org_rehearsal_id\` (READY, cardano-ctf level repo URL)" "- Worker PID: \`$(cat worker.pid)\`" >>"$record"
echo "registered account=$user_id vendor=$vendor_id coworker=$coworker_id"
