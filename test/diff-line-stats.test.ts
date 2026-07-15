import { describe, expect, test } from "bun:test";
import {
  countContentLines,
  findGitLineStats,
  parseGitNumstat,
  sumLineStats,
} from "../src/features/diff-review/shared/lib/diff-line-stats.js";

describe("diff line stats", () => {
  test("parses regular, renamed, and binary numstat entries", () => {
    const entries = parseGitNumstat(
      "5\t2\tsrc/file.ts\0" +
        "1\t0\t\0src/old.ts\0src/new.ts\0" +
        "-\t-\tasset.bin\0",
    );

    expect(entries).toEqual([
      {
        oldPath: "src/file.ts",
        newPath: "src/file.ts",
        lineStats: { additions: 5, deletions: 2 },
      },
      {
        oldPath: "src/old.ts",
        newPath: "src/new.ts",
        lineStats: { additions: 1, deletions: 0 },
      },
      {
        oldPath: "asset.bin",
        newPath: "asset.bin",
        lineStats: null,
      },
    ]);
    expect(
      findGitLineStats(
        entries,
        "renamed",
        "src/old.ts",
        "src/new.ts",
      ),
    ).toEqual({ additions: 1, deletions: 0 });
  });

  test("counts unterminated content as a line", () => {
    expect(countContentLines("")).toBe(0);
    expect(countContentLines("one\ntwo\n")).toBe(2);
    expect(countContentLines("one\ntwo")).toBe(2);
  });

  test("sums available stats and ignores unknown binary counts", () => {
    expect(
      sumLineStats([
        { additions: 5, deletions: 2 },
        null,
        { additions: 1, deletions: 4 },
      ]),
    ).toEqual({ additions: 6, deletions: 6 });
  });
});
