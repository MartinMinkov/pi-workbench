import type { ResponseReviewCommentKind } from "../../../../shared/contracts/review-comment-kinds.js";
export {
  DEFAULT_RESPONSE_REVIEW_COMMENT_KIND,
  getReviewCommentKindLabel,
  getReviewCommentKindPromptLabel,
  RESPONSE_REVIEW_COMMENT_KINDS,
} from "../../../../shared/contracts/review-comment-kinds.js";
export type { ResponseReviewCommentKind } from "../../../../shared/contracts/review-comment-kinds.js";

export type ResponseReviewResponse = {
  id: string;
  title: string;
  preview: string;
  text: string;
  timestamp?: number;
};

export type ResponseReviewWindowData = {
  responses: ResponseReviewResponse[];
  initialResponseId?: string;
};

export type ResponseReviewComment = {
  id: string;
  responseId: string;
  kind: ResponseReviewCommentKind;
  selectedText: string;
  comment: string;
  startOffset?: number;
  endOffset?: number;
};

export type ResponseReviewSubmitPayload = {
  type: "submit";
  requestId: string;
  activeResponseId: string;
  overallComment: string;
  overallCommentKind: ResponseReviewCommentKind;
  draft: string;
  comments: ResponseReviewComment[];
};

export type ResponseReviewCancelPayload = {
  type: "cancel";
};

export type ResponseReviewWindowMessage =
  | ResponseReviewSubmitPayload
  | ResponseReviewCancelPayload;

export type ResponseReviewSubmitAckMessage = {
  type: "submit-ack";
  requestId: string;
  commentCount: number;
  hasOverallComment: boolean;
  hasDraft: boolean;
};

export type ResponseReviewHostMessage = ResponseReviewSubmitAckMessage;
