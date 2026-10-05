import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import packageJson from '../package.json' with { type: 'json' };


function git(...args: string[]): string {
  return execFileSync('git', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function isAncestor(ancestorSha: string, headSha: string): boolean {
  try {
    git('merge-base', '--is-ancestor', ancestorSha, headSha);
    return true;
  } catch (err) {
    if (err &&
      typeof err === 'object' &&
      'status' in err &&
      err.status === 1
    )
      return false;

    throw err;
  }
}

function getOriginAncestors(head: string): string[] {
  const remoteRefs = git(
    'for-each-ref',
    '--format=%(refname)',
    'refs/remotes/origin'
  )
    .split('\n')
    .filter(Boolean);

  if (remoteRefs.length === 0)
    throw new Error('No origin remote-tracking refs are available');

  const candidates = remoteRefs
    .map((ref) => {
      try {
        return git('rev-parse', ref);
      } catch {
        return null;
      }
    })
    .filter((sha): sha is string => sha !== null);

  return [...new Set(candidates)].filter((sha) => isAncestor(sha, head));
}

function getClosestRef(head: string, candidates: string[]): string {
  return candidates.reduce((best, candidate) => {
    const dist = Number(git('rev-list', '--count', `${candidate}..${head}`));
    const bestDist = Number(git('rev-list', '--count', `${best}..${head}`));
    return dist < bestDist ? candidate : best;
  });
}

function getGithubRef(): string {
  if (process.env.CI) {
    const ref = process.env.GITHUB_REF;
    if (!ref) throw new Error('GITHUB_REF is not available in CI');
    return ref;
  }

  const head = git('rev-parse', 'HEAD');
  const candidates = getOriginAncestors(head);

  if (candidates.length === 0)
    throw new Error(
      'Could not find a GitHub-known ancestor of the current commit'
    );

  return getClosestRef(head, candidates);
}

function getAssetsURL(githubRef: string): string {
  const repositoryUrl = packageJson.repository;

  if (typeof repositoryUrl !== 'string')
    throw new Error('package.json "repository" must be a string URL');

  const repoPath = repositoryUrl
    .replace(/^https:\/\/github\.com\//, '')
    .replace(/\.git$/, '');

  return `https://raw.githubusercontent.com/${repoPath}/${githubRef}`;
}

const githubRef = getGithubRef();
const assetsURL = getAssetsURL(githubRef);

const outputPath = resolve('src/generated/build-info.ts');

mkdirSync(dirname(outputPath), { recursive: true });

writeFileSync(
  outputPath,
  `export const buildInfo = ${JSON.stringify(
    {
      githubRef,
      assetsURL,
    },
    null,
    4
  )} as const;\n`
);

console.log(`Generated ${outputPath}`);
console.log(`GitHub ref: ${githubRef}`);
console.log(`Assets URL: ${assetsURL}`);