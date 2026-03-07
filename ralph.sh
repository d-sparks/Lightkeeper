#!/usr/bin/env bash
set -euo pipefail

# ─── Ralph Loop for Lightkeeper TODOs ─────────────────────────
# Parses TODOs.md, runs Claude Code for each bullet point on the
# current branch, then loops back and repeats until killed.
# Must be run on a non-main branch.
#
# Usage:
#   ./ralph.sh                  # Run all TODOs in a loop
#   ./ralph.sh --dry-run        # Preview tasks without executing
#   ./ralph.sh --start 3        # Start from TODO #3 (first pass only)
#   ./ralph.sh --only 5         # Run only TODO #5 (then loop)
#   ./ralph.sh --max-turns 30   # Limit Claude to 30 agentic turns per task (default: 100)
#   ./ralph.sh --yolo           # Use --dangerously-skip-permissions

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
TODOS_FILE="$REPO_ROOT/TODOs.md"
DRY_RUN=false
START_AT=1
ONLY=""
MAX_TURNS=100
YOLO=false
LOG_DIR="$REPO_ROOT/.claude/ralph-logs"
FIVE_HOUR_LIMIT=80
SEVEN_DAY_DAILY_RESERVE=14  # Reserve 14% of 7-day capacity per remaining day

# ─── Rate limit check ────────────────────────────────────────
# Runs cclimits and blocks until:
#   - 5h window is under 80%
#   - 7d window has enough headroom (reserves 14% per remaining day)
wait_for_capacity() {
  while true; do
    local output
    output="$(cclimits 2>/dev/null)" || { echo "  cclimits failed, waiting 60s..."; sleep 60; continue; }

    local five_hour seven_day reset_time
    five_hour="$(echo "$output" | grep -A1 '5-Hour Window' | grep 'Used:' | grep -oP '[\d.]+')"
    seven_day="$(echo "$output" | grep -A1 '7-Day Window' | grep 'Used:' | grep -oP '[\d.]+')"
    # Parse "Resets in: 153h 28m" for 7-day window
    reset_time="$(echo "$output" | grep -A3 '7-Day Window' | grep 'Resets in:' | grep -oP '[\d]+(?=h)')"

    if [[ -z "$five_hour" || -z "$seven_day" || -z "$reset_time" ]]; then
      echo "  Could not parse cclimits output, waiting 60s..."
      sleep 60
      continue
    fi

    local five_int="${five_hour%%.*}"
    local seven_int="${seven_day%%.*}"

    # Dynamic 7-day limit: reserve 14% per remaining day
    local days_remaining=$(( (reset_time + 23) / 24 ))  # round up
    local reserved=$(( days_remaining * SEVEN_DAY_DAILY_RESERVE ))
    local seven_day_limit=$(( 100 - reserved ))
    # Clamp to at least 0
    if [[ "$seven_day_limit" -lt 0 ]]; then seven_day_limit=0; fi

    local ok=true
    if [[ "$five_int" -ge "$FIVE_HOUR_LIMIT" ]]; then ok=false; fi
    if [[ "$seven_int" -ge "$seven_day_limit" ]]; then ok=false; fi

    if $ok; then
      echo "  Usage OK (5h: ${five_hour}%, 7d: ${seven_day}% / limit ${seven_day_limit}%, ${reset_time}h to reset)"
      return 0
    fi

    echo "  Usage too high (5h: ${five_hour}%/${FIVE_HOUR_LIMIT}%, 7d: ${seven_day}%/${seven_day_limit}%) — waiting 5m..."
    sleep 300
  done
}

# ─── Parse args ───────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case $1 in
    --dry-run)   DRY_RUN=true; shift ;;
    --start)     START_AT="$2"; shift 2 ;;
    --only)      ONLY="$2"; shift 2 ;;
    --max-turns) MAX_TURNS="$2"; shift 2 ;;
    --yolo)      YOLO=true; shift ;;
    *)           echo "Unknown arg: $1"; exit 1 ;;
  esac
done

# ─── Build the prompt for Claude ─────────────────────────────
build_prompt() {
  local task="$1"
  cat <<PROMPT
You are working on the Lightkeeper codebase. Read CLAUDE.md for project conventions.

## Task
${task}

## Instructions
- Read the relevant code before making changes. Explore thoroughly.
- Follow all conventions in CLAUDE.md (data-driven content, server-authoritative, vanilla JS).
- If this is a Content task, prefer JSON data changes over engine code changes.
- If this is a Game/Engine task, keep changes minimal and focused.
- If this is an Editor task, changes go in editor/app.js and editor/style.css.
- If a task is too vague or would require design decisions, implement the most reasonable interpretation and note your assumptions in the commit message.
- Test these changes to the extent that you can with the sim tools.
- If there are outstanding action items, add those to a list in docs/NEXT_TODOS.md.
- After all that make sure to commit changes.
- Do NOT push to remote. Do NOT create a PR. Just commit locally.
PROMPT
}

# ─── Parse TODOs into an array ─────────────────────────────────
parse_todos() {
  TASKS=()
  while IFS= read -r line; do
    if [[ "$line" =~ ^-\ (.+) ]]; then
      TASKS+=("${BASH_REMATCH[1]}")
    fi
  done < "$TODOS_FILE"
}

# ─── Assert we're not on main ──────────────────────────────────
CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$CURRENT_BRANCH" == "main" ]]; then
  echo "ERROR: Do not run ralph on main. Check out a feature branch first."
  exit 1
fi

# ─── Main loop: repeat forever ─────────────────────────────────
PASS=0
while true; do
  PASS=$((PASS + 1))

  parse_todos

  if [[ ${#TASKS[@]} -eq 0 ]]; then
    echo "No TODOs found in ${TODOS_FILE}. Waiting 30s..."
    sleep 30
    continue
  fi

  echo ""
  echo "╔═══════════════════════════════════════════════════════╗"
  echo "  Pass #${PASS} — ${#TASKS[@]} task(s)"
  echo "  Branch: ${CURRENT_BRANCH}"
  echo "╚═══════════════════════════════════════════════════════╝"

  if $DRY_RUN; then
    for i in "${!TASKS[@]}"; do
      num=$((i + 1))
      echo "  [dry-run] TODO #${num}: ${TASKS[$i]:0:80}"
    done
    echo ""
    echo "Dry run complete."
    exit 0
  fi

  # Log dir for this pass
  pass_log_dir="${LOG_DIR}/ralph-pass-${PASS}"
  mkdir -p "$pass_log_dir"

  # ─── Run each task ──────────────────────────────────────────
  for i in "${!TASKS[@]}"; do
    num=$((i + 1))
    raw_task="${TASKS[$i]}"

    # Parse optional [model] prefix, e.g. "[sonnet] Do something"
    task_model=""
    task="$raw_task"
    if [[ "$raw_task" =~ ^\[([a-zA-Z0-9._-]+)\]\ (.+) ]]; then
      task_model="${BASH_REMATCH[1]}"
      task="${BASH_REMATCH[2]}"
    fi

    # Apply --start filter (first pass only)
    if [[ "$PASS" -eq 1 && "$num" -lt "$START_AT" ]]; then continue; fi
    # Apply --only filter
    if [[ -n "$ONLY" && "$num" -ne "$ONLY" ]]; then continue; fi

    echo ""
    echo "  ───────────────────────────────────────────────────"
    echo "  TODO #${num}: ${task:0:80}$([ ${#task} -gt 80 ] && echo '...')"
    if [[ -n "$task_model" ]]; then
      echo "  Model: ${task_model}"
    fi
    echo "  ───────────────────────────────────────────────────"

    # Wait until usage is under the limit before starting
    wait_for_capacity

    prompt="$(build_prompt "$task")"

    echo "  Running Claude (max ${MAX_TURNS} turns, model: ${task_model:-default})..."
    echo ""

    CLAUDE_ARGS=(--max-turns "$MAX_TURNS" --verbose)
    if [[ -n "$task_model" ]]; then
      CLAUDE_ARGS+=(--model "$task_model")
    fi
    if $YOLO; then
      CLAUDE_ARGS+=(--dangerously-skip-permissions)
    fi

    (
      echo "$prompt" | claude "${CLAUDE_ARGS[@]}" \
        2>&1 | tee "${pass_log_dir}/.claude-ralph-log-${num}.txt"
    ) || {
      echo "  Claude exited with non-zero status for TODO #${num}, continuing..."
    }
  done

  # Reset --start after first pass
  START_AT=1

  echo ""
  echo "  Pass #${PASS} complete. Looping..."
  echo ""
done
