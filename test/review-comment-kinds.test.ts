import { describe, expect, it } from "bun:test";

import {
  DEFAULT_DIFF_REVIEW_COMMENT_KIND,
  DIFF_REVIEW_COMMENT_KINDS,
  type ReviewSubmitPayload,
} from "../src/features/diff-review/shared/contracts/review.ts";
import { composeReviewPrompt } from "../src/features/diff-review/host/prompt/compose-review-prompt.ts";
import {
  DEFAULT_RESPONSE_REVIEW_COMMENT_KIND,
  RESPONSE_REVIEW_COMMENT_KINDS,
  type ResponseReviewSubmitPayload,
} from "../src/features/response-review/shared/contracts/response-review.ts";
import { composeResponseReviewPrompt } from "../src/features/response-review/host/prompt.ts";

describe("review comment kind contracts", () => {
  it.each([
    ["diff review", DIFF_REVIEW_COMMENT_KINDS, DEFAULT_DIFF_REVIEW_COMMENT_KIND],
    ["response review", RESPONSE_REVIEW_COMMENT_KINDS, DEFAULT_RESPONSE_REVIEW_COMMENT_KIND],
  ] as const)("keeps %s question-first", (_label, kinds, defaultKind) => {
    expect(kinds.at(0)?.value).toBe("question");
    expect(defaultKind).toBe("question");
  });
});

describe("composeReviewPrompt", () => {
  it("uses the submitted overall comment kind", () => {
    const payload = {
      type: "submit",
      requestId: "review-1",
      overallComment: "Please clarify this choice.",
      overallCommentKind: "question",
      comments: [],
    } satisfies ReviewSubmitPayload;

    const prompt = composeReviewPrompt([], payload);

    expect(prompt.split("\n")).toContain("0. [Question] [overall]");
  });
});

describe("composeResponseReviewPrompt", () => {
  it("uses the submitted overall comment kind", () => {
    const payload = {
      type: "submit",
      requestId: "response-review-1",
      activeResponseId: "response-1",
      overallComment: "Please clarify this choice.",
      overallCommentKind: "question",
      draft: "",
      comments: [],
    } satisfies ResponseReviewSubmitPayload;

    const prompt = composeResponseReviewPrompt([], payload);

    expect(prompt.split("\n")).toContain("0. [Question] [overall]");
  });
});
