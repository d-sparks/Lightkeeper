#!/usr/bin/env bash
set -euo pipefail

# ─── Restore Ralph Worktrees ─────────────────────────────────
# Finds all ralph/* branches (local or remote) that don't already
# have a worktree, and creates one for each.
#
# Usage:
#   ./restore_ralph_worktrees.sh              # Restore all ralph branches
#   ./restore_ralph_worktrees.sh --dry-run    # Preview without making changes

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
WORKTREE_DIR="$REPO_ROOT/.claude/worktrees"
DRY_RUN=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --dry-run) DRY_RUN=true; shift ;;
    *)         echo "Unknown arg: $1"; exit 1 ;;
  esac
done

# ─── Slugify for worktree directory names ─────────────────────
slugify() {
  echo "$1" \
    | tr '[:upper:]' '[:lower:]' \
    | sed 's/[^a-z0-9 ]//g' \
    | sed 's/  */ /g' \
    | cut -c1-50 \
    | sed 's/ /-/g' \
    | sed 's/-$//'
}

# ─── Collect branches that already have worktrees ─────────────
declare -A HAS_WORKTREE=()
while IFS= read -r line; do
  if [[ "$line" =~ ^branch\ refs/heads/(.+)$ ]]; then
    HAS_WORKTREE["${BASH_REMATCH[1]}"]=1
  fi
done < <(git -C "$REPO_ROOT" worktree list --porcelain)

# ─── Find all ralph/* branches ────────────────────────────────
git fetch origin --prune 2>/dev/null || true

declare -a BRANCHES=()
declare -A SEEN=()

# Local branches
while IFS= read -r branch; do
  branch="${branch#"${branch%%[![:space:]]*}"}"  # trim leading whitespace
  branch="${branch#\* }"                          # trim active branch marker
  if [[ "$branch" == ralph/* && -z "${SEEN[$branch]+x}" ]]; then
    BRANCHES+=("$branch")
    SEEN[$branch]=1
  fi
done < <(git -C "$REPO_ROOT" branch --list 'ralph/*' 2>/dev/null)

# Remote branches (that don't have a local counterpart)
while IFS= read -r ref; do
  branch="${ref#origin/}"
  if [[ "$branch" == ralph/* && -z "${SEEN[$branch]+x}" ]]; then
    BRANCHES+=("$branch")
    SEEN[$branch]=1
  fi
done < <(git -C "$REPO_ROOT" branch -r --list 'origin/ralph/*' 2>/dev/null)

if [[ ${#BRANCHES[@]} -eq 0 ]]; then
  echo "No ralph/* branches found."
  exit 0
fi

# ─── Filter to branches without worktrees ─────────────────────
declare -a TO_RESTORE=()
declare -a ALREADY=()
for branch in "${BRANCHES[@]}"; do
  if [[ -n "${HAS_WORKTREE[$branch]+x}" ]]; then
    ALREADY+=("$branch")
  else
    TO_RESTORE+=("$branch")
  fi
done

echo "Found ${#BRANCHES[@]} ralph branch(es): ${#TO_RESTORE[@]} to restore, ${#ALREADY[@]} already have worktrees"
echo "────────────────────────────────────────"

if [[ ${#ALREADY[@]} -gt 0 ]]; then
  for branch in "${ALREADY[@]}"; do
    echo "  [skip] ${branch} (worktree exists)"
  done
fi

if [[ ${#TO_RESTORE[@]} -eq 0 ]]; then
  echo ""
  echo "Nothing to restore."
  exit 0
fi

# ─── Create worktrees ────────────────────────────────────────
mkdir -p "$WORKTREE_DIR"

for branch in "${TO_RESTORE[@]}"; do
  # Strip ralph/ prefix for the directory name
  slug="$(slugify "${branch#ralph/}")"
  worktree_path="${WORKTREE_DIR}/ralph-${slug}"

  echo ""
  echo "═══════════════════════════════════════════════════════"
  echo "  Branch:   ${branch}"
  echo "  Worktree: ${worktree_path}"
  echo "═══════════════════════════════════════════════════════"

  if $DRY_RUN; then
    echo "  [dry-run] Would create worktree"
    continue
  fi

  # Clean up stale worktree at this path if needed
  if git -C "$REPO_ROOT" worktree list --porcelain | grep -q "$worktree_path"; then
    echo "  Stale worktree at path, removing..."
    git -C "$REPO_ROOT" worktree remove "$worktree_path" --force 2>/dev/null || true
  fi

  # Check out the branch into a worktree
  if git -C "$REPO_ROOT" show-ref --verify --quiet "refs/heads/$branch"; then
    git -C "$REPO_ROOT" worktree add "$worktree_path" "$branch"
  elif git -C "$REPO_ROOT" show-ref --verify --quiet "refs/remotes/origin/$branch"; then
    git -C "$REPO_ROOT" worktree add "$worktree_path" -b "$branch" "origin/$branch"
  else
    echo "  ERROR: Could not resolve branch '${branch}'. Skipping."
    continue
  fi

  echo "  Worktree created."
done

echo ""
echo "════════════════════════════════════════════"
echo "  Restore complete."
echo "════════════════════════════════════════════"

echo ""
echo "Active worktrees:"
git -C "$REPO_ROOT" worktree list
