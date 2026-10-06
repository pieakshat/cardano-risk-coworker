#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"
readonly forbidden_user="01a10fa2-aaf1-71da-97b6-13a0081efeb8"
readonly org_id="01a109d1-32a9-71da-97e3-658b2a7987cd"
readonly worker_name="Cardano Risk Analyst"
readonly vendor_name="Cardano Risk Analyst"
readonly vendor_slug="cardano-risk-analyst-2026"
readonly setup_file="SETUP-RECORD.md"

test -f /tmp/briefs/account2.ready || { echo "account2.ready is absent; no Sokosumi writes attempted" >&2; exit 2; }
identity="$(sokosumi --preprod auth whoami --json)"
user_id="$(jq -r '.user.id' <<<"$identity")"
test "$user_id" != "$forbidden_user" || { echo "refusing submission-1 account" >&2; exit 3; }

json_file=$(mktemp)
trap 'rm -f "$json_file"' EXIT

vendors="$(sokosumi --preprod vendors me --json)"
vendor_id="$(jq -r '.vendors[] | select(.role == "admin") | .id' <<<"$vendors" | head -n1)"
if test -z "$vendor_id"; then
  vendor_id="$(sokosumi --preprod vendors create --name "$vendor_name" --slug "$vendor_slug" --json | tee "$json_file" | jq -r '.vendor.id // .id')"
fi
test -n "$vendor_id" && test "$vendor_id" != "01a10fcf-be3e-766d-b32c-300330ed9187"

coworkers="$(sokosumi --preprod coworkers list --scope owned --json)"
coworker_id="$(jq -r --arg name "$worker_name" '.coworkers[] | select(.name == $name) | .id' <<<"$coworkers" | head -n1)"
if test -z "$coworker_id"; then
  coworker_id="$(sokosumi --preprod coworkers register --personal --vendor-id "$vendor_id" --name "$worker_name" --capability tasks --json | tee "$json_file" | jq -r '.coworker.id // .id')"
else
  sokosumi --preprod coworkers connect "$coworker_id" --personal --vendor-id "$vendor_id" --json >/dev/null
fi
test -n "$coworker_id"

if ! grep -q '^SOKOSUMI_COWORKER_API_KEY=' .env.local 2>/dev/null; then
  sokosumi --preprod coworkers api-key "$coworker_id" --json >"$json_file"
  key="$(jq -r '.apiKey.token // .token' "$json_file")"
  test "$key" != null && test -n "$key"
  umask 077
  printf 'SOKOSUMI_COWORKER_API_KEY=%q\n' "$key" >> .env.local
  printf '%s' "$key" | sokosumi --preprod runtime key-import --coworker-id "$coworker_id" --api-key-stdin >/dev/null
fi

personal_tasks="$(sokosumi --preprod tasks list --personal --json)"
create_task() {
  local name="$1" description="$2"
  if ! jq -e --arg id "$coworker_id" --arg name "$name" '.tasks[] | select(.coworkerId == $id and .name == $name)' <<<"$personal_tasks" >/dev/null; then
    sokosumi --preprod tasks create --personal --coworker-id "$coworker_id" --name "$name" --description "$description" --status READY --json >>"$setup_file"
  fi
}
create_task "Cardano Risk Analyst rehearsal" "Analyze the Cardano token MIN and return the cited risk memo plus JSON report."
create_task "Cardano Risk Analyst paid test" "Analyze the Cardano token SNEK and return the cited risk memo plus JSON report."

sokosumi --preprod coworkers connect "$coworker_id" --vendor-id "$vendor_id" --workspace-id "$org_id" --json >"$json_file"
{
  printf '\n## Account-2 registration\n- Account: `%s`\n- Vendor: `%s`\n- Coworker: `%s`\n' "$user_id" "$vendor_id" "$coworker_id"
  printf '%s\n' '- TOKEN2049 access request: submitted by Coworker connect.'
} >>"$setup_file"
echo "registered account=$user_id vendor=$vendor_id coworker=$coworker_id"
