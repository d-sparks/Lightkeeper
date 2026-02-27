#!/usr/bin/env bash
set -euo pipefail

# ─── Ralph Loop for Lightkeeper TODOs ─────────────────────────
# Parses TODOs.md, creates one branch + worktree per section header,
# runs Claude Code for each task (committing on the same branch),
# then opens one PR per section.
#
# Usage:
#   ./ralph.sh                  # Run all TODOs (uses permission settings from ~/.claude/settings.json)
#   ./ralph.sh --dry-run        # Preview tasks without executing
#   ./ralph.sh --start 3        # Start from TODO #3
#   ./ralph.sh --only 5         # Run only TODO #5
#   ./ralph.sh --section Game   # Run only TODOs under the "Game" header
#   ./ralph.sh --max-turns 30   # Limit Claude to 30 agentic turns per task (default: 50)
#   ./ralph.sh --yolo           # Use --dangerously-skip-permissions (READ WARNING BELOW)
#
# SECURITY NOTE on --yolo:
#   --dangerously-skip-permissions removes ALL permission prompts but provides
#   ZERO sandboxing. Claude can run any bash command your user can — delete files
#   outside the worktree, read ~/.ssh, make network requests, etc.
#   Without --yolo, Claude uses your allowlist from ~/.claude/settings.json and
#   prompts for anything not pre-approved. This is safer for unattended runs.
#   If you want full autonomy + safety, use --yolo with Claude's built-in
#   sandboxing (macOS only as of Feb 2026): set sandbox_mode in settings.

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
TODOS_FILE="$REPO_ROOT/TODOs.md"
WORKTREE_DIR="$REPO_ROOT/.claude/worktrees"
BASE_BRANCH="main"
DRY_RUN=false
START_AT=1
ONLY=""
SECTION_FILTER=""
MAX_TURNS=50
YOLO=false

# ─── Parse args ───────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case $1 in
    --dry-run)   DRY_RUN=true; shift ;;
    --start)     START_AT="$2"; shift 2 ;;
    --only)      ONLY="$2"; shift 2 ;;
    --section)   SECTION_FILTER="$2"; shift 2 ;;
    --max-turns) MAX_TURNS="$2"; shift 2 ;;
    --yolo)      YOLO=true; shift ;;
    *)           echo "Unknown arg: $1"; exit 1 ;;
  esac
done

# ─── Parse TODOs into arrays ─────────────────────────────────
declare -a CATEGORIES=()
declare -a TASKS=()

current_category=""
while IFS= read -r line; do
  # Category headers are lines without leading "- "
  if [[ "$line" =~ ^[A-Za-z] ]]; then
    current_category="$line"
  elif [[ "$line" =~ ^-\ (.+) ]]; then
    CATEGORIES+=("$current_category")
    TASKS+=("${BASH_REMATCH[1]}")
  fi
done < "$TODOS_FILE"

echo "Found ${#TASKS[@]} TODOs"
echo "────────────────────────────────────────"

# ─── Collect unique section headers (preserving order) ────────
declare -a SECTIONS=()
declare -A SEEN_SECTIONS=()
for cat in "${CATEGORIES[@]}"; do
  if [[ -z "${SEEN_SECTIONS[$cat]+x}" ]]; then
    SECTIONS+=("$cat")
    SEEN_SECTIONS[$cat]=1
  fi
done

# ─── Slugify a string into a branch-safe name ─────────────────
slugify() {
  echo "$1" \
    | tr '[:upper:]' '[:lower:]' \
    | sed 's/[^a-z0-9 ]//g' \
    | sed 's/  */ /g' \
    | cut -c1-50 \
    | sed 's/ /-/g' \
    | sed 's/-$//'
}

# ─── Build the prompt for Claude ─────────────────────────────
build_prompt() {
  local category="$1"
  local task="$2"
  cat <<PROMPT
You are working on the Lightkeeper codebase. Read CLAUDE.md for project conventions.

## Task Category: ${category}

## Task
${task}

## Instructions
- Read the relevant code before making changes. Explore thoroughly.
- Follow all conventions in CLAUDE.md (data-driven content, server-authoritative, vanilla JS).
- If this is a Content task, prefer JSON data changes over engine code changes.
- If this is a Game/Engine task, keep changes minimal and focused.
- If this is an Editor task, changes go in editor/app.js and editor/style.css.
- If a task is too vague or would require design decisions, implement the most reasonable interpretation and note your assumptions in the commit message.
- When finished, commit all changes with a descriptive message.
- Do NOT push to remote. Do NOT create a PR. Just commit locally.
PROMPT
}

# ─── Main loop: iterate over sections ─────────────────────────
for section in "${SECTIONS[@]}"; do
  # Apply --section filter
  if [[ -n "$SECTION_FILTER" && "$section" != "$SECTION_FILTER" ]]; then continue; fi

  # Collect task indices for this section that pass --start/--only filters
  section_task_indices=()
  for i in "${!TASKS[@]}"; do
    num=$((i + 1))
    if [[ "${CATEGORIES[$i]}" != "$section" ]]; then continue; fi
    if [[ -n "$ONLY" && "$num" -ne "$ONLY" ]]; then continue; fi
    if [[ "$num" -lt "$START_AT" ]]; then continue; fi
    section_task_indices+=("$i")
  done

  # Skip section if no tasks to run
  if [[ ${#section_task_indices[@]} -eq 0 ]]; then continue; fi

  section_slug="$(slugify "$section")"
  branch="ralph/${section_slug}"
  worktree_path="${WORKTREE_DIR}/ralph-${section_slug}"

  echo ""
  echo "╔═══════════════════════════════════════════════════════╗"
  echo "  Section: ${section} (${#section_task_indices[@]} task(s))"
  echo "  Branch:  ${branch}"
  echo "╚═══════════════════════════════════════════════════════╝"

  if $DRY_RUN; then
    for idx in "${section_task_indices[@]}"; do
      num=$((idx + 1))
      echo "  [dry-run] TODO #${num}: ${TASKS[$idx]:0:80}"
    done
    echo "  [dry-run] Would create worktree at: ${worktree_path}"
    continue
  fi

  # Ensure clean state
  if git worktree list --porcelain | grep -q "$worktree_path"; then
    echo "  Worktree already exists, removing..."
    git worktree remove "$worktree_path" --force 2>/dev/null || true
  fi
  git branch -D "$branch" 2>/dev/null || true

  # Create branch + worktree
  mkdir -p "$WORKTREE_DIR"
  git worktree add -b "$branch" "$worktree_path" "$BASE_BRANCH"
  echo "  Worktree created: ${worktree_path}"

  # ─── Inner loop: run each task in this section ──────────────
  for idx in "${section_task_indices[@]}"; do
    num=$((idx + 1))
    task="${TASKS[$idx]}"

    echo ""
    echo "  ───────────────────────────────────────────────────"
    echo "  TODO #${num}: ${task:0:80}$([ ${#task} -gt 80 ] && echo '...')"
    echo "  ───────────────────────────────────────────────────"

    prompt="$(build_prompt "$section" "$task")"

    echo "  Running Claude (max ${MAX_TURNS} turns)..."
    echo ""

    CLAUDE_ARGS=(--max-turns "$MAX_TURNS" --verbose)
    if $YOLO; then
      CLAUDE_ARGS+=(--dangerously-skip-permissions)
    fi

    (
      cd "$worktree_path"
      echo "$prompt" | claude "${CLAUDE_ARGS[@]}" \
        2>&1 | tee "${worktree_path}/.claude-ralph-log-${num}.txt"
    ) || {
      echo "  Claude exited with non-zero status for TODO #${num}, continuing..."
    }
  done

  # Check if there are any commits beyond base
  cd "$worktree_path"
  commits_ahead=$(git rev-list --count "${BASE_BRANCH}..HEAD" 2>/dev/null || echo "0")

  if [[ "$commits_ahead" -gt 0 ]]; then
    echo ""
    echo "  ${commits_ahead} commit(s) on branch ${branch}. Pushing and creating PR..."
    git push -u origin "$branch"

    # Build PR body listing all tasks in this section
    task_list=""
    for idx in "${section_task_indices[@]}"; do
      num=$((idx + 1))
      task_list+=$'\n'"- TODO #${num}: ${TASKS[$idx]}"
    done

    pr_title="[Ralph] ${section}"
    pr_body="$(cat <<EOF
## Auto-generated by Ralph Loop

**Section:** ${section}

### Tasks
${task_list}

---
Generated autonomously by Claude Code via ralph.sh.
Review carefully before merging.
EOF
)"
    gh pr create \
      --base "$BASE_BRANCH" \
      --head "$branch" \
      --title "${pr_title:0:72}" \
      --body "$pr_body" \
      || echo "  PR creation failed (may already exist)"

    echo "  PR created for section: ${section}"
  else
    echo "  No commits were made for section ${section}. Skipping PR."
  fi

  # Return to repo root
  cd "$REPO_ROOT"

  echo "  Done with section: ${section}."
  echo ""
done

echo ""
echo "════════════════════════════════════════════"
echo "  Ralph loop complete."
echo "════════════════════════════════════════════"

# Summary: list worktrees and PRs
echo ""
echo "Active worktrees:"
git worktree list
echo ""
echo "Open PRs:"
gh pr list --author "@me" --search "Ralph" 2>/dev/null || true
