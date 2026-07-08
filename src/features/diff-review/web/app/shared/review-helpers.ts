import {
  DEFAULT_DIFF_REVIEW_COMMENT_KIND,
  DIFF_REVIEW_COMMENT_KINDS,
  getReviewCommentKindLabel,
  type DiffReviewCommentKind,
  type DiffReviewComment,
  type ReviewNavigationTarget,
} from "../../shared/contracts/review.js";

export function getCommentKind(
  comment: DiffReviewComment,
): DiffReviewCommentKind {
  return comment.kind ?? DEFAULT_DIFF_REVIEW_COMMENT_KIND;
}

export function getCommentKindLabel(kind: DiffReviewCommentKind): string {
  return getReviewCommentKindLabel(
    DIFF_REVIEW_COMMENT_KINDS,
    kind,
    DEFAULT_DIFF_REVIEW_COMMENT_KIND,
  );
}

export function createComment(
  partial: Omit<DiffReviewComment, "id" | "kind"> & {
    kind?: DiffReviewCommentKind;
  },
): DiffReviewComment {
  return {
    id: `${Date.now()}:${Math.random().toString(16).slice(2)}`,
    kind: partial.kind ?? DEFAULT_DIFF_REVIEW_COMMENT_KIND,
    ...partial,
  };
}

function escapeForClipboard(value: string): string {
  return value.replace(/\r\n/g, "\n");
}

export async function writeToClipboard(value: string): Promise<boolean> {
  const text = escapeForClipboard(value);
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fall through to the legacy clipboard path.
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    textarea.remove();
  }
}

export function sameNavigationTarget(
  left: ReviewNavigationTarget | null,
  right: ReviewNavigationTarget | null,
): boolean {
  if (!left || !right) return false;
  return (
    left.fileId === right.fileId &&
    left.scope === right.scope &&
    left.side === right.side &&
    left.line === right.line &&
    left.column === right.column
  );
}
