import { describe, it, expect } from 'vitest';
import { normalizeGitRemote, mergeArtifacts } from '../../src/extractor/infer-artifact.js';

describe('normalizeGitRemote', () => {
  it.each([
    ['git@github.com:vamo-ai/recruiter-bot.git', 'https://github.com/vamo-ai/recruiter-bot'],
    ['https://github.com/vamo-ai/recruiter-bot.git', 'https://github.com/vamo-ai/recruiter-bot'],
    ['https://github.com/vamo-ai/recruiter-bot', 'https://github.com/vamo-ai/recruiter-bot'],
    ['ssh://git@github.com/CameronWhiteside/handprint.git', 'https://github.com/CameronWhiteside/handprint'],
    ['git@gitlab.com:group/proj.git', 'https://gitlab.com/group/proj'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeGitRemote(input)).toBe(expected);
  });

  it('returns null for junk', () => {
    expect(normalizeGitRemote('')).toBeNull();
    expect(normalizeGitRemote('not a remote')).toBeNull();
  });
});

describe('mergeArtifacts', () => {
  it('dedupes by uri, keeping first', () => {
    const merged = mergeArtifacts(
      [{ type: 'url', uri: 'https://github.com/a/b' }],
      [
        { type: 'git-repo', uri: 'https://github.com/a/b' },
        { type: 'git-repo', uri: 'file:///local-proj' },
      ]
    );
    expect(merged).toEqual([
      { type: 'url', uri: 'https://github.com/a/b' },
      { type: 'git-repo', uri: 'file:///local-proj' },
    ]);
  });
});
