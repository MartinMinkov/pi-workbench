import type {
  ChangeStatus,
  ReviewLineStats,
} from "../contracts/review.js";

export interface GitNumstatEntry {
  oldPath: string;
  newPath: string;
  lineStats: ReviewLineStats | null;
}

function parseLineStats(
  additions: string,
  deletions: string,
): ReviewLineStats | null {
  if (!/^\d+$/.test(additions) || !/^\d+$/.test(deletions)) return null;
  return {
    additions: Number(additions),
    deletions: Number(deletions),
  };
}

/** Parses `git diff --numstat -z` output without losing rename paths. */
export function parseGitNumstat(output: string): GitNumstatEntry[] {
  const fields = output.split("\0");
  const entries: GitNumstatEntry[] = [];

  for (let index = 0; index < fields.length; index += 1) {
    const field = fields[index];
    if (!field) continue;

    const match = field.match(/^([^\t]+)\t([^\t]+)\t(.*)$/s);
    if (!match) continue;

    const [, additions, deletions, path] = match;
    if (path) {
      entries.push({
        oldPath: path,
        newPath: path,
        lineStats: parseLineStats(additions, deletions),
      });
      continue;
    }

    const oldPath = fields[index + 1];
    const newPath = fields[index + 2];
    if (oldPath == null || newPath == null) continue;
    entries.push({
      oldPath,
      newPath,
      lineStats: parseLineStats(additions, deletions),
    });
    index += 2;
  }

  return entries;
}

export function findGitLineStats(
  entries: GitNumstatEntry[],
  status: ChangeStatus,
  oldPath: string | null,
  newPath: string | null,
): ReviewLineStats | null {
  const entry =
    status === "renamed"
      ? entries.find(
          (candidate) =>
            candidate.oldPath === oldPath && candidate.newPath === newPath,
        )
      : entries.find(
          (candidate) =>
            candidate.oldPath === (newPath ?? oldPath) &&
            candidate.newPath === (newPath ?? oldPath),
        );
  return entry?.lineStats ?? null;
}

export function countContentLines(content: string): number {
  if (content.length === 0) return 0;
  const newlineCount = content.match(/\n/g)?.length ?? 0;
  return newlineCount + (content.endsWith("\n") ? 0 : 1);
}

export function sumLineStats(
  values: Array<ReviewLineStats | null>,
): ReviewLineStats {
  return values.reduce<ReviewLineStats>(
    (total, value) => ({
      additions: total.additions + (value?.additions ?? 0),
      deletions: total.deletions + (value?.deletions ?? 0),
    }),
    { additions: 0, deletions: 0 },
  );
}
