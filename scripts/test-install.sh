#!/usr/bin/env bash
# Manual local test: fully installs each recipe in Docker and verifies it works.
# Usage: ./scripts/test-install.sh [recipe...] [-- extra-flags]
# Examples:
#   ./scripts/test-install.sh              # test all recipes
#   ./scripts/test-install.sh ruby         # test only ruby
#   ./scripts/test-install.sh dart ruby    # test dart and ruby
#   ./scripts/test-install.sh ollama -- --preset gemma3  # pass flags to jules-env
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
BOLD='\033[1m'
RESET='\033[0m'

IMAGE="jules-env"

verify_cmd() {
  case "$1" in
    dart)    echo 'dart --version' ;;
    flutter) echo 'flutter --version' ;;
    ruby)    echo 'ruby --version && gem --version' ;;
    php)        echo 'php --version && composer --version' ;;
    php-sqlite) echo 'php -m | grep -q sqlite3' ;;
    laravel)    echo 'laravel --version' ;;
    ollama)     echo 'ollama --version' ;;
    *)          echo '' ;;
  esac
}

prereq_cmd() {
  case "$1" in
    php-sqlite) echo 'jules-env use php' ;;
    laravel)    echo 'jules-env use php && source ~/.jules/shellenv && jules-env use php-sqlite' ;;
    *)          echo '' ;;
  esac
}

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
  else
    recipes+=("$arg")
  fi
done

if [ ${#recipes[@]} -eq 0 ]; then
  recipes=(dart flutter ruby php php-sqlite laravel ollama)
fi

echo -e "${BOLD}Building Docker image...${RESET}"
docker build -t "$IMAGE" .
echo ""

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

  prereq="$(prereq_cmd "$recipe")"
  if [ -n "$prereq" ]; then
    run_cmd="$prereq && $use_cmd && source ~/.jules/shellenv && $verify"
  else
    run_cmd="$use_cmd && source ~/.jules/shellenv && $verify"
  fi

  if docker run --rm "$IMAGE" bash -c "$run_cmd"; then
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
