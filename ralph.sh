#!/usr/bin/env bash
set -euo pipefail

# ─── Ralph Loop for Lightkeeper TODOs ─────────────────────────
# Alternates between TODOs.md and TODOs_loop.md:
#   1. Run all tasks in TODOs.md
#   2. Run all tasks in TODOs_loop.md (which regenerates TODOs.md)
#   3. Repeat
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
TODOS_LOOP_FILE="$REPO_ROOT/TODOs_loop.md"
DRY_RUN=false
START_AT=1
ONLY=""
MAX_TURNS=100
YOLO=false
LOG_DIR="$REPO_ROOT/.claude/ralph-logs"
DAILY_LIMIT=80    # Stop if 5-hour usage >= this %
WEEKLY_RATE=17             # Max % of 7-day budget per day
WEEKLY_START="2026-03-07"  # Budget start date (day 1)

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
  local file="$1"
  TASKS=()
  while IFS= read -r line; do
    if [[ "$line" =~ ^-\ (.+) ]]; then
      TASKS+=("${BASH_REMATCH[1]}")
    fi
  done < "$file"
}

# ─── Budget check via cclimits ─────────────────────────────────
check_budget() {
  if ! command -v cclimits &>/dev/null; then
    echo "  WARNING: cclimits not found, skipping budget check"
    return 0
  fi

  local json
  json="$(cclimits --json 2>/dev/null)" || {
    echo "  WARNING: cclimits failed, skipping budget check"
    return 0
  }

  # Extract used% as floats (strip the % suffix)
  local daily_used weekly_used
  daily_used="$(echo "$json" | node -e "
    const d = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
    const v = d.claude?.five_hour?.used || '0%';
    console.log(parseFloat(v));
  " 2>/dev/null)" || daily_used="0"
  weekly_used="$(echo "$json" | node -e "
    const d = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
    const v = d.claude?.seven_day?.used || '0%';
    console.log(parseFloat(v));
  " 2>/dev/null)" || weekly_used="0"

  # Compute dynamic weekly limit: WEEKLY_RATE% per day since WEEKLY_START
  local start_epoch now_epoch days_elapsed weekly_limit
  start_epoch="$(date -d "$WEEKLY_START" +%s)"
  now_epoch="$(date +%s)"
  days_elapsed=$(( (now_epoch - start_epoch) / 86400 + 1 ))
  weekly_limit=$((days_elapsed * WEEKLY_RATE))

  echo "  Budget: 5h ${daily_used}% / ${DAILY_LIMIT}% cap, 7d ${weekly_used}% / ${weekly_limit}% cap (day ${days_elapsed}, ${WEEKLY_RATE}%/day)"

  # Compare as integers (bash can't do float comparison)
  local daily_int weekly_int
  daily_int="$(echo "$daily_used" | node -e "console.log(Math.floor(parseFloat(require('fs').readFileSync('/dev/stdin','utf8'))))" 2>/dev/null)" || daily_int=0
  weekly_int="$(echo "$weekly_used" | node -e "console.log(Math.floor(parseFloat(require('fs').readFileSync('/dev/stdin','utf8'))))" 2>/dev/null)" || weekly_int=0

  if [[ "$daily_int" -ge "$DAILY_LIMIT" ]]; then
    echo "  BUDGET STOP: 5-hour usage ${daily_used}% >= ${DAILY_LIMIT}% cap."
    budget_summary
    exit 0
  fi
  if [[ "$weekly_int" -ge "$weekly_limit" ]]; then
    echo "  BUDGET STOP: 7-day usage ${weekly_used}% >= ${weekly_limit}% cap (day ${days_elapsed})."
    budget_summary
    exit 0
  fi
  return 0
}

budget_summary() {
  echo ""
  echo "  ╔═══════════════════════════════════════════════════════╗"
  echo "    Ralph stopped — budget limit reached"
  echo "  ╚═══════════════════════════════════════════════════════╝"
  if [[ ${#DONE_TASKS[@]} -gt 0 ]]; then
    echo "  Completed tasks:"
    for entry in "${DONE_TASKS[@]}"; do
      echo "    [done] ${entry}"
    done
  else
    echo "  No tasks completed this run."
  fi
  # Show remaining by diffing all tasks against done
  echo ""
  echo "  Remaining tasks:"
  for i in "${!TASKS[@]}"; do
    local num=$((i + 1))
    local label="#${num}: ${TASKS[$i]:0:80}"
    local is_done=false
    for d in "${DONE_TASKS[@]+"${DONE_TASKS[@]}"}"; do
      if [[ "$d" == "$label" ]]; then is_done=true; break; fi
    done
    if ! $is_done; then
      echo "    [todo] ${label}"
    fi
  done
  echo ""
}

# ─── Assert we're not on main ──────────────────────────────────
CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$CURRENT_BRANCH" == "main" ]]; then
  echo "ERROR: Do not run ralph on main. Check out a feature branch first."
  exit 1
fi

# ─── Task tracking ───────────────────────────────────────────
DONE_TASKS=()

# ─── Run all tasks from a given file ──────────────────────────
run_tasks_from_file() {
  local file="$1"
  local file_label="$2"

  parse_todos "$file"

  if [[ ${#TASKS[@]} -eq 0 ]]; then
    echo "  No tasks found in ${file_label}. Skipping."
    return 0
  fi

  echo ""
  echo "╔═══════════════════════════════════════════════════════╗"
  echo "  Pass #${PASS} — ${file_label} — ${#TASKS[@]} task(s)"
  echo "  Branch: ${CURRENT_BRANCH}"
  echo "╚═══════════════════════════════════════════════════════╝"

  if $DRY_RUN; then
    for i in "${!TASKS[@]}"; do
      num=$((i + 1))
      echo "  [dry-run] ${file_label} #${num}: ${TASKS[$i]:0:80}"
    done
    return 0
  fi

  # Log dir for this pass
  pass_log_dir="${LOG_DIR}/ralph-pass-${PASS}"
  mkdir -p "$pass_log_dir"

  # Reset done tracking for this phase
  DONE_TASKS=()

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

    # Apply --start filter (first pass only, TODOs.md only)
    if [[ "$PASS" -eq 1 && "$file" == "$TODOS_FILE" && "$num" -lt "$START_AT" ]]; then continue; fi
    # Apply --only filter (TODOs.md only)
    if [[ -n "$ONLY" && "$file" == "$TODOS_FILE" && "$num" -ne "$ONLY" ]]; then continue; fi

    # Check budget before each task
    check_budget

    echo ""
    echo "  ───────────────────────────────────────────────────"
    echo "  ${file_label} #${num}: ${task:0:80}$([ ${#task} -gt 80 ] && echo '...')"
    if [[ -n "$task_model" ]]; then
      echo "  Model: ${task_model}"
    fi
    echo "  ───────────────────────────────────────────────────"

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
        2>&1 | tee "${pass_log_dir}/.claude-ralph-log-${file_label}-${num}.txt"
    ) || {
      echo "  Claude exited with non-zero status for ${file_label} #${num}, continuing..."
    }

    DONE_TASKS+=("#${num}: ${task:0:80}")
  done
}

# ─── Main loop: alternate TODOs.md ↔ TODOs_loop.md ───────────
PASS=0
while true; do
  PASS=$((PASS + 1))

  # Phase 1: Run tasks from TODOs.md
  run_tasks_from_file "$TODOS_FILE" "TODOs"

  # Phase 2: Run tasks from TODOs_loop.md
  run_tasks_from_file "$TODOS_LOOP_FILE" "TODOs_loop"

  if $DRY_RUN; then
    echo ""
    echo "Dry run complete."
    exit 0
  fi

  # Reset --start after first pass
  START_AT=1

  echo ""
  echo "  Pass #${PASS} complete (TODOs + TODOs_loop). Looping..."
  echo ""
done
