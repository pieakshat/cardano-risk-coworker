#!/usr/bin/env bash
set -euo pipefail

root=$(cd "$(dirname "$0")/../.." && pwd)
lane="$root/security/worker"
record="$lane/SETUP-RECORD.md"
worker_record="$root/worker/SETUP-RECORD.md"
account1="01a10fa2-aaf1-71da-97b6-13a0081efeb8"
event_workspace="01a109d1-32a9-71a3-a0e3-658b2a7987cd"

test -e /tmp/briefs/account2.ready || { echo "waiting for /tmp/briefs/account2.ready" >&2; exit 2; }
whoami=$(sokosumi --preprod auth whoami --json)
user_id=$(printf '%s' "$whoami" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).user.id))')
test "$user_id" != "$account1" || { echo "submission-1 account is active" >&2; exit 3; }

json_id() { node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const x=JSON.parse(s); console.log(x.id ?? x.data?.id ?? x.vendor?.id ?? x.coworker?.id ?? "")})'; }
record_id() { rg -o "$1[^0-9a-f]*[0-9a-f]{8}-[0-9a-f-]{27,}" "$2" 2>/dev/null | head -1 | rg -o '[0-9a-f]{8}-[0-9a-f-]{27,}' || true; }
save() { printf "\n- %s: \`%s\`\n" "$1" "$2" >> "$record"; }

vendor_id=$(record_id 'Vendor' "$worker_record")
if [ -z "$vendor_id" ]; then
  vendor_id=$(sokosumi --preprod vendors me --json | json_id)
fi
if [ -z "$vendor_id" ]; then
  vendor_id=$(sokosumi --preprod vendors create --name "Cardano Risk Review" --slug cardano-risk-review --json | json_id)
fi
test -n "$vendor_id" || { echo "no current-account Vendor available" >&2; exit 4; }
save "Account-2 user" "$user_id"
save "Vendor" "$vendor_id"

coworker_id=$(record_id 'Coworker' "$record")
if [ -z "$coworker_id" ]; then
  coworker_id=$(sokosumi --preprod coworkers list --scope owned --json | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const x=JSON.parse(s);const xs=Array.isArray(x)?x:(x.data??x.coworkers??[]);console.log(xs.find(v=>v.name==="Aiken Security Reviewer")?.id??"")})')
fi
if [ -z "$coworker_id" ]; then
  coworker_id=$(sokosumi --preprod coworkers provision --vendor-id "$vendor_id" --name "Aiken Security Reviewer" --capability tasks --json | json_id)
fi
test -n "$coworker_id" || { echo "Coworker provisioning returned no ID" >&2; exit 5; }
save "Coworker" "$coworker_id"

if ! rg -q 'Runtime key: `present`' "$record" 2>/dev/null; then
  key_json=$(sokosumi --preprod coworkers api-key "$coworker_id" --json)
  key=$(printf '%s' "$key_json" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const x=JSON.parse(s);console.log(x.apiKey?.token??x.token??"")})')
  test -n "$key" || { echo "runtime key was not returned" >&2; exit 6; }
  umask 077
  printf 'SOKOSUMI_COWORKER_ID=%s\nSOKOSUMI_COWORKER_API_KEY=%s\n' "$coworker_id" "$key" > "$lane/.env.local"
  printf '%s\n' "$key" | sokosumi --preprod runtime key-import --coworker-id "$coworker_id" --api-key-stdin >/dev/null
  save "Runtime key" "present"
fi

if ! rg -q 'Rehearsal Task:' "$record" 2>/dev/null; then
  rehearsal=$(sokosumi --preprod tasks create --personal --coworker-id "$coworker_id" --name "Aiken reviewer rehearsal" --description '{"repoUrl":"https://github.com/Invariant-0/cardano-ctf","path":"bank_01_deposit_vulnerability"}' --status READY --json)
  rehearsal_id=$(printf '%s' "$rehearsal" | json_id)
  save "Rehearsal Task" "$rehearsal_id"
fi

if [ "${RUN_PAID_TASK:-false}" = true ] && ! rg -q 'Paid Task:' "$record" 2>/dev/null; then
  paid=$(sokosumi --preprod tasks create --personal --coworker-id "$coworker_id" --name "Paid Aiken security review" --description '{"repoUrl":"https://github.com/Invariant-0/cardano-ctf","path":"bank_01_deposit_vulnerability"}' --status READY --json)
  paid_id=$(printf '%s' "$paid" | json_id)
  save "Paid Task" "$paid_id"
elif [ "${RUN_PAID_TASK:-false}" != true ]; then
  printf '%s\n' 'Credits not confirmed. Set RUN_PAID_TASK=true after funding the Personal Workspace, then rerun register.sh.' > /tmp/briefs/risk.human
fi

if ! rg -q 'TOKEN2049 access:' "$record" 2>/dev/null; then
  access=$(sokosumi --preprod coworkers connect "$coworker_id" --vendor-id "$vendor_id" --workspace-id "$event_workspace" --json)
  access_id=$(printf '%s' "$access" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const x=JSON.parse(s);console.log(x.id??x.accessId??x.data?.id??"unknown")})')
  save "TOKEN2049 access" "$access_id"
fi

printf '%s\n' "registered current account $user_id with Coworker $coworker_id"
