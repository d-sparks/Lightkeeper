const { execFileSync } = require('child_process');
const https = require('https');
const path = require('path');

const APP_DIR = path.join(__dirname, '..');
let gitReady = false;
let useLocalGit = false; // True when using existing repo + SSH instead of GITHUB_TOKEN

function git(args, opts) {
  return execFileSync('git', args, {
    cwd: APP_DIR,
    encoding: 'utf8',
    timeout: 30000,
    ...opts,
  }).trim();
}

/**
 * Idempotent git initialization.
 *
 * Two modes:
 * 1. GITHUB_TOKEN + GITHUB_REPO set: Uses HTTPS with token auth (deployed environments).
 * 2. Neither set: Falls back to the existing repo's origin remote, using the user's
 *    SSH agent / git credential helper (local development).
 */
function initGit() {
  if (gitReady) return;

  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO; // "owner/repo"

  if (token && repo) {
    // Deployed mode: HTTPS with token
    const remoteUrl = `https://x-access-token:${token}@github.com/${repo}.git`;

    try {
      git(['rev-parse', '--git-dir']);
    } catch {
      git(['init']);
    }

    git(['config', 'user.email', 'editor@lightkeeper.game']);
    git(['config', 'user.name', 'Lightkeeper Editor']);

    try {
      git(['remote', 'set-url', 'origin', remoteUrl]);
    } catch {
      git(['remote', 'add', 'origin', remoteUrl]);
    }

    const baseBranch = process.env.GITHUB_BASE_BRANCH || 'main';
    git(['fetch', 'origin', baseBranch, '--depth=1']);
    git(['reset', `origin/${baseBranch}`]);
  } else {
    // Local mode: use existing repo and user's SSH/credential config
    try {
      git(['rev-parse', '--git-dir']);
    } catch {
      throw new Error('Not a git repository and GITHUB_TOKEN/GITHUB_REPO not set');
    }

    // Verify an origin remote exists
    try {
      git(['remote', 'get-url', 'origin']);
    } catch {
      throw new Error('No "origin" remote configured and GITHUB_TOKEN/GITHUB_REPO not set');
    }

    useLocalGit = true;
    const baseBranch = process.env.GITHUB_BASE_BRANCH || 'main';
    git(['fetch', 'origin', baseBranch]);
  }

  gitReady = true;
}

/**
 * Publish content changes: create branch, commit, push, open PR.
 * Returns { branch, prUrl } on success.
 */
async function publishChanges(message) {
  const baseBranch = process.env.GITHUB_BASE_BRANCH || 'main';

  initGit();

  // Re-fetch in case main has advanced since init
  git(['fetch', 'origin', baseBranch, ...(useLocalGit ? [] : ['--depth=1'])]);

  // Create a new branch from origin/main without touching working tree
  const ts = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
  const branch = `content/editor-${ts}`;

  git(['branch', branch, `origin/${baseBranch}`]);
  git(['symbolic-ref', 'HEAD', `refs/heads/${branch}`]);
  git(['reset', `origin/${baseBranch}`]); // index = main, working tree untouched

  // Stage all content
  git(['add', 'content/']);

  // Check if there are actual changes
  try {
    git(['diff', '--cached', '--quiet']);
    throw new Error('No content changes to publish');
  } catch (e) {
    // If the error is our own "No content changes" message, re-throw
    if (e.message === 'No content changes to publish') throw e;
    // Otherwise, diff --quiet exited non-zero = there ARE changes. Good.
  }

  const commitMsg = message || 'Content update from Lightkeeper editor';
  git(['commit', '-m', commitMsg]);
  git(['push', '-u', 'origin', branch]);

  // Create PR via GitHub API
  const prUrl = await createPR(branch, baseBranch, commitMsg);

  return { branch, prUrl };
}

function createPR(branch, baseBranch, title) {
  // In local mode, try gh CLI for PR creation; fall back to just returning the branch
  if (useLocalGit) {
    try {
      const prUrl = execFileSync('gh', [
        'pr', 'create',
        '--title', title,
        '--body', `Content update pushed from the Lightkeeper level editor.\n\nBranch: \`${branch}\``,
        '--base', baseBranch,
        '--head', branch,
      ], { cwd: APP_DIR, encoding: 'utf8', timeout: 30000 }).trim();
      return Promise.resolve(prUrl);
    } catch {
      // gh CLI not available or failed — return null (branch was still pushed)
      return Promise.resolve(null);
    }
  }

  const repo = process.env.GITHUB_REPO;
  const token = process.env.GITHUB_TOKEN;
  const [owner, repoName] = repo.split('/');

  const data = JSON.stringify({
    title,
    head: branch,
    base: baseBranch,
    body: `Content update pushed from the Lightkeeper level editor.\n\nBranch: \`${branch}\``,
  });

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.github.com',
      path: `/repos/${owner}/${repoName}/pulls`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'User-Agent': 'Lightkeeper-Editor',
        'Content-Length': Buffer.byteLength(data),
      },
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          if (res.statusCode === 201) {
            resolve(json.html_url);
          } else {
            reject(new Error(`GitHub API ${res.statusCode}: ${json.message || body}`));
          }
        } catch {
          reject(new Error(`GitHub API response parse error: ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

/**
 * List remote branches.
 * Returns an array of branch name strings (e.g. ['main', 'content/editor-20250101']).
 */
function listBranches() {
  initGit();
  git(['fetch', 'origin', '--prune']);
  const raw = git(['branch', '-r', '--format=%(refname:short)']);
  return raw.split('\n')
    .map(b => b.trim())
    .filter(b => b && !b.includes('HEAD'))
    .map(b => b.replace(/^origin\//, ''));
}

// Track the currently loaded branch (null = local working tree / default)
let activeBranch = null;

/**
 * Load content from a specific remote branch.
 * Fetches the branch and checks out the content/ directory from it,
 * replacing local content files on disk.
 */
function loadBranchContent(branch) {
  initGit();
  const safeBranch = branch.replace(/[^a-zA-Z0-9_./-]/g, '');
  if (!safeBranch) throw new Error('Invalid branch name');

  git(['fetch', 'origin', safeBranch]);
  // Overlay content/ from the remote branch onto the working tree
  git(['checkout', `origin/${safeBranch}`, '--', 'content/']);
  activeBranch = safeBranch;
  return { branch: safeBranch };
}

/**
 * Refresh content from the currently active branch.
 * Re-fetches and re-checks out content/ to pick up new commits.
 */
function refreshBranchContent() {
  if (!activeBranch) throw new Error('No branch is currently loaded');
  initGit();
  git(['fetch', 'origin', activeBranch]);
  git(['checkout', `origin/${activeBranch}`, '--', 'content/']);
  return { branch: activeBranch };
}

/**
 * Get the currently loaded branch name, or null if none.
 */
function getActiveBranch() {
  return activeBranch;
}

function isConfigured() {
  if (process.env.GITHUB_TOKEN && process.env.GITHUB_REPO) return true;
  // Check if we're in a git repo with an origin remote (local/SSH mode)
  try {
    git(['remote', 'get-url', 'origin']);
    return true;
  } catch {
    return false;
  }
}

module.exports = { publishChanges, isConfigured, listBranches, loadBranchContent, refreshBranchContent, getActiveBranch };
