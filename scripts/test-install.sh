#!/usr/bin/env bash
# Manual local test: fully installs each recipe in Docker and verifies it works.
# Usage: ./scripts/test-install.sh [--no-build] [recipe...] [-- extra-flags]
# Examples:
#   ./scripts/test-install.sh              # test all recipes
#   ./scripts/test-install.sh ruby         # test only ruby
#   ./scripts/test-install.sh dart ruby    # test dart and ruby
#   ./scripts/test-install.sh --no-build ruby  # skip image build
#   ./scripts/test-install.sh ollama -- --preset gemma3  # pass flags to jules-env
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
BOLD='\033[1m'
RESET='\033[0m'

IMAGE="jules-env"
NO_BUILD=false
TIMEOUT=300

# Split args on "--": recipes before, extra flags after
recipes=()
extra_flags=""
seen_separator=false
for arg in "$@"; do
  if [ "$arg" = "--" ]; then
    seen_separator=true
    continue
  fi
  if $seen_separator; then
    extra_flags="$extra_flags $arg"
  elif [ "$arg" = "--no-build" ]; then
    NO_BUILD=true
  else
    recipes+=("$arg")
  fi
done

if [ "$NO_BUILD" = false ]; then
  echo -e "${BOLD}Building Docker image...${RESET}"
  docker build -t "$IMAGE" .
  echo ""
fi

# Cache recipe metadata from the built image
recipe_json=$(docker run --rm "$IMAGE" jules-env list --json --verify)

verify_cmd() {
  echo "$recipe_json" | jq -r --arg name "$1" '.[] | select(.name == $name) | .verify // empty'
}

if [ ${#recipes[@]} -eq 0 ]; then
  # Get all recipes that have a verify command
  mapfile -t recipes < <(echo "$recipe_json" | jq -r '.[] | select(.verify) | .name')
  # Skip slow/complex recipes in CI
  if [ "${CI:-}" = "true" ]; then
    # Filter out flutter and ollama for CI
    filtered=()
    for r in "${recipes[@]}"; do
      case "$r" in
        flutter|ollama) ;;
        *) filtered+=("$r") ;;
      esac
    done
    recipes=("${filtered[@]}")
  fi
fi

pass=0
fail=0

for recipe in "${recipes[@]}"; do
  verify="$(verify_cmd "$recipe")"
  if [ -z "$verify" ]; then
    echo -e "${RED}SKIP${RESET} $recipe — no verification command defined"
    continue
  fi

  use_cmd="jules-env use $recipe$extra_flags"

  echo -e "${BOLD}Testing: $recipe${RESET}"
  echo "  Install: $use_cmd"
  echo "  Verify:  $verify"

  run_cmd="$use_cmd && source ~/.jules/shellenv && $verify"

  if timeout "$TIMEOUT" docker run --rm "$IMAGE" bash -c "$run_cmd"; then
    echo -e "  ${GREEN}PASS${RESET} $recipe"
    pass=$((pass + 1))
  else
    echo -e "  ${RED}FAIL${RESET} $recipe"
    fail=$((fail + 1))
  fi
  echo ""
done

echo -e "${BOLD}Results: ${GREEN}$pass passed${RESET}, ${RED}$fail failed${RESET}"
[ "$fail" -eq 0 ]
