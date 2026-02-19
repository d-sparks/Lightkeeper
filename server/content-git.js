const { execFileSync } = require('child_process');
const https = require('https');
const path = require('path');

const APP_DIR = path.join(__dirname, '..');
let gitReady = false;

function git(args) {
  return execFileSync('git', args, {
    cwd: APP_DIR,
    encoding: 'utf8',
    timeout: 30000,
  }).trim();
}

/**
 * Idempotent git initialization.
 * Sets up a repo with the GitHub remote so we can push content branches.
 */
function initGit() {
  if (gitReady) return;

  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO; // "owner/repo"
  if (!token || !repo) {
    throw new Error('GITHUB_TOKEN and GITHUB_REPO must be set');
  }

  const remoteUrl = `https://x-access-token:${token}@github.com/${repo}.git`;

  try {
    git(['rev-parse', '--git-dir']);
  } catch {
    git(['init']);
  }

  git(['config', 'user.email', 'editor@lightkeeper.game']);
  git(['config', 'user.name', 'Lightkeeper Editor']);

  // Set or update remote
  try {
    git(['remote', 'set-url', 'origin', remoteUrl]);
  } catch {
    git(['remote', 'add', 'origin', remoteUrl]);
  }

  const baseBranch = process.env.GITHUB_BASE_BRANCH || 'main';
  git(['fetch', 'origin', baseBranch, '--depth=1']);

  // Point HEAD at origin/main without touching working tree
  git(['reset', `origin/${baseBranch}`]);

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
  git(['fetch', 'origin', baseBranch, '--depth=1']);

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

function isConfigured() {
  return !!(process.env.GITHUB_TOKEN && process.env.GITHUB_REPO);
}

module.exports = { publishChanges, isConfigured };
