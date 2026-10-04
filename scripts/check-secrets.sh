#!/usr/bin/env bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

mode=${1:-staged}
if command -v gitleaks >/dev/null 2>&1; then
  scanner=$(command -v gitleaks)
elif [[ -x "$HOME/.local/bin/gitleaks.exe" ]]; then
  scanner="$HOME/.local/bin/gitleaks.exe"
else
  echo "Secret scan blocked: install Gitleaks in PATH or ~/.local/bin/gitleaks.exe." >&2
  exit 2
fi

blocked=0
check_path() {
  local file="$1" base="${1##*/}"
  case "$base" in
    .env|.env.*)
      case "$base" in *.example|*.sample|*.template) return ;; esac ;;
    *.jks|*.keystore|*.p12|*.pfx|*.key|*.pem|*.pyc|*.pyo|.netrc|.pypirc|application-local.yml|application-local.yaml|application-local.properties|service-account*.json|credentials.json) ;;
    *)
      case "$file" in
        .idea/dataSources*|.idea/db-forest-config.xml|.idea/workspace*.xml*|*/__pycache__/*|.aws/credentials|.config/shuumatu/*) ;;
        *) return ;;
      esac ;;
  esac
  echo "Secret scan blocked: local credential/generated file: $file" >&2
  blocked=1
}

case "$mode" in
  staged)
    while IFS= read -r -d '' file; do check_path "$file"; done < <(git diff --cached --name-only --diff-filter=ACMR -z)
    [[ "$blocked" == 0 ]] || exit 1
    exec "$scanner" git . --pre-commit --staged --config .gitleaks.toml --redact=100 --ignore-gitleaks-allow --no-banner
    ;;
  history)
    revision=${2:-HEAD}
    git rev-parse --verify "$revision^{commit}" >/dev/null
    while IFS= read -r -d '' file; do check_path "$file"; done < <(git ls-tree -r --name-only -z "$revision")
    [[ "$blocked" == 0 ]] || exit 1
    exec "$scanner" git . --log-opts="$revision" --config .gitleaks.toml --redact=100 --ignore-gitleaks-allow --no-banner
    ;;
  *) echo "Usage: bash scripts/check-secrets.sh [staged | history REVISION]" >&2; exit 2 ;;
esac
