export interface ReviewCommentKindDefinition<TKind extends string> {
  value: TKind;
  label: string;
  promptLabel: string;
  description: string;
}

export const DIFF_REVIEW_COMMENT_KINDS = [
  {
    value: "question",
    label: "Question",
    promptLabel: "Question",
    description: "Ask for clarification; do not change code unless explicitly requested.",
  },
  {
    value: "feedback",
    label: "Feedback",
    promptLabel: "Feedback",
    description: "Request a valid code or behavior change.",
  },
  {
    value: "risk",
    label: "Risk",
    promptLabel: "Risk",
    description: "Investigate a possible correctness, security, or performance risk.",
  },
  {
    value: "explain",
    label: "Explain",
    promptLabel: "Explain",
    description: "Explain the relevant behavior, tradeoff, or design.",
  },
  {
    value: "tests",
    label: "Tests",
    promptLabel: "Tests",
    description: "Add or update verification when appropriate.",
  },
] as const satisfies readonly ReviewCommentKindDefinition<string>[];

export const RESPONSE_REVIEW_COMMENT_KINDS = [
  {
    value: "question",
    label: "Question",
    promptLabel: "Question",
    description: "Ask for clarification without implying a code or plan change.",
  },
  {
    value: "feedback",
    label: "Feedback",
    promptLabel: "Feedback",
    description: "Request a valid change to the prior response or next action.",
  },
  {
    value: "correction",
    label: "Correction",
    promptLabel: "Correction",
    description: "Correct or retract a prior statement, assumption, plan, or suggestion.",
  },
  {
    value: "preference",
    label: "Preference",
    promptLabel: "Preference",
    description: "Adapt approach, tone, structure, or tradeoff to a stated preference.",
  },
  {
    value: "follow-up",
    label: "Follow-up",
    promptLabel: "Follow-up",
    description: "Expand on a point or continue an investigation.",
  },
] as const satisfies readonly ReviewCommentKindDefinition<string>[];

export type DiffReviewCommentKind =
  (typeof DIFF_REVIEW_COMMENT_KINDS)[number]["value"];
export type ResponseReviewCommentKind =
  (typeof RESPONSE_REVIEW_COMMENT_KINDS)[number]["value"];

export const DEFAULT_DIFF_REVIEW_COMMENT_KIND: DiffReviewCommentKind = "question";
export const DEFAULT_RESPONSE_REVIEW_COMMENT_KIND: ResponseReviewCommentKind =
  "question";

export function getReviewCommentKindLabel<TKind extends string>(
  definitions: readonly ReviewCommentKindDefinition<TKind>[],
  kind: TKind | undefined,
  fallback: TKind,
): string {
  return (
    definitions.find((definition) => definition.value === (kind ?? fallback)) ??
    definitions.find((definition) => definition.value === fallback) ??
    definitions[0]
  ).label;
}

export function getReviewCommentKindPromptLabel<TKind extends string>(
  definitions: readonly ReviewCommentKindDefinition<TKind>[],
  kind: TKind | undefined,
  fallback: TKind,
): string {
  return (
    definitions.find((definition) => definition.value === (kind ?? fallback)) ??
    definitions.find((definition) => definition.value === fallback) ??
    definitions[0]
  ).promptLabel;
}
