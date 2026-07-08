import {
  DEFAULT_RESPONSE_REVIEW_COMMENT_KIND,
  getReviewCommentKindLabel,
  RESPONSE_REVIEW_COMMENT_KINDS,
  type ResponseReviewComment,
  type ResponseReviewCommentKind,
  type ResponseReviewHostMessage,
  type ResponseReviewResponse,
  type ResponseReviewWindowData,
  type ResponseReviewWindowMessage,
} from "../shared/contracts/response-review.js";
import {
  escapeHtml,
  renderMarkdown,
  type MarkdownOutlineItem,
} from "../../../shared/web/markdown.js";

declare global {
  interface Window {
    glimpse?: {
      send(payload: unknown): void;
      close(): void;
    };
    __responseReviewReceive?: (message: ResponseReviewHostMessage) => void;
  }
}


type PendingSelection = {
  text: string;
  startOffset?: number;
  endOffset?: number;
};

const data = JSON.parse(
  document.getElementById("response-review-data")?.textContent ?? "{}",
) as ResponseReviewWindowData;

const responses = data.responses ?? [];
const comments: ResponseReviewComment[] = [];
let activeResponseId = data.initialResponseId ?? responses.at(-1)?.id ?? responses[0]?.id ?? "";
let responseFilter = "";
let pendingSelection: PendingSelection | null = null;
let editingCommentId: string | null = null;
let submitPending = false;

const responseListEl = requireElement<HTMLDivElement>("response-list");
const outlineListEl = requireElement<HTMLDivElement>("outline-list");
const responseContentEl = requireElement<HTMLElement>("response-content");
const responseScrollEl = requireElement<HTMLDivElement>("response-scroll");
const activeTitleEl = requireElement<HTMLDivElement>("active-title");
const activeMetaEl = requireElement<HTMLDivElement>("active-meta");
const responseSearchEl = requireElement<HTMLInputElement>("response-search");
const commentSelectionButton = requireElement<HTMLButtonElement>("comment-selection-button");
const copySelectionButton = requireElement<HTMLButtonElement>("copy-selection-button");
const commentListEl = requireElement<HTMLDivElement>("comment-list");
const overallCommentEl = requireElement<HTMLTextAreaElement>("overall-comment");
const overallKindEl = requireElement<HTMLSelectElement>("overall-kind");
const draftEl = requireElement<HTMLTextAreaElement>("draft");
const submitButton = requireElement<HTMLButtonElement>("submit-button");
const cancelButton = requireElement<HTMLButtonElement>("cancel-button");
const statusEl = requireElement<HTMLDivElement>("status");
const modalEl = requireElement<HTMLDivElement>("comment-modal");
const modalSelectionEl = requireElement<HTMLDivElement>("modal-selection");
const modalKindEl = requireElement<HTMLSelectElement>("modal-kind");
const modalCommentEl = requireElement<HTMLTextAreaElement>("modal-comment");
const modalCancelButton = requireElement<HTMLButtonElement>("modal-cancel");
const modalSaveButton = requireElement<HTMLButtonElement>("modal-save");
const commentCardById = new Map<string, HTMLDivElement>();


let selectedCommentId: string | null = null;
let staleCommentIds = new Set<string>();
function requireElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing #${id}`);
  return element as T;
}

function activeResponse(): ResponseReviewResponse | undefined {
  return responses.find((response) => response.id === activeResponseId) ?? responses.at(-1);
}


function commentKindLabel(kind: ResponseReviewCommentKind): string {
  return getReviewCommentKindLabel(
    RESPONSE_REVIEW_COMMENT_KINDS,
    kind,
    DEFAULT_RESPONSE_REVIEW_COMMENT_KIND,
  );
}

function renderKindOptions(selectedKind: ResponseReviewCommentKind): string {
  return RESPONSE_REVIEW_COMMENT_KINDS.map((definition) => {
    const selected = definition.value === selectedKind ? " selected" : "";
    return `<option value="${escapeHtml(definition.value)}" title="${escapeHtml(definition.description)}"${selected}>${escapeHtml(definition.label)}</option>`;
  }).join("");
}

function populateKindSelect(
  select: HTMLSelectElement,
  selectedKind: ResponseReviewCommentKind,
): void {
  select.innerHTML = renderKindOptions(selectedKind);
  select.value = selectedKind;
}

function shortText(value: string, max = 220): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > max ? `${normalized.slice(0, max - 1)}…` : normalized;
}

function send(message: ResponseReviewWindowMessage): void {
  if (window.glimpse) {
    window.glimpse.send(message);
    return;
  }
  console.log("response-review message", message);
}

function flash(message: string): void {
  statusEl.textContent = message;
  window.setTimeout(() => {
    if (statusEl.textContent === message) statusEl.textContent = "";
  }, 2200);
}


function renderResponses(): void {
  const filtered = responses.filter((response) => {
    if (!responseFilter) return true;
    const haystack = `${response.title} ${response.preview}`.toLowerCase();
    return haystack.includes(responseFilter.toLowerCase());
  });

  responseListEl.innerHTML = "";
  if (filtered.length === 0) {
    responseListEl.innerHTML = `<div class="text-xs leading-5 text-review-muted">No matching responses.</div>`;
    return;
  }

  for (const response of filtered) {
    const button = document.createElement("button");
    button.className = [
      "rounded-xl border bg-review-panel-2 p-2.5 text-left text-review-text",
      "hover:border-review-accent/60 hover:bg-[#18212c]",
      response.id === activeResponseId
        ? "border-review-accent shadow-[inset_3px_0_0_#58a6ff]"
        : "border-review-border",
    ].join(" ");
    const count = comments.filter((comment) => comment.responseId === response.id).length;
    button.innerHTML = `
      <div class="mb-1 text-xs font-bold text-white">${escapeHtml(response.title)}</div>
      <div class="text-[11px] leading-5 text-review-muted">${escapeHtml(response.preview)}</div>
      ${count > 0 ? `<div class="text-[11px] leading-5 text-review-muted">${count} comment${count === 1 ? "" : "s"}</div>` : ""}
    `;
    button.addEventListener("click", () => {
      activeResponseId = response.id;
      renderAll();
    });
    responseListEl.appendChild(button);
  }
}

function renderActiveResponse(): void {
  const response = activeResponse();
  if (!response) {
    activeTitleEl.textContent = "No response selected";
    activeMetaEl.textContent = "";
    responseContentEl.innerHTML = `<p>No assistant responses are available.</p>`;
    outlineListEl.innerHTML = "";
    return;
  }

  activeTitleEl.textContent = response.title;
  activeMetaEl.textContent = `${response.text.length.toLocaleString()} characters · ${comments.filter((comment) => comment.responseId === response.id).length} comments`;
  const rendered = renderMarkdown(response.text, {
    includeOutline: true,
    codeCommentButtons: true,
  });
  responseContentEl.innerHTML = rendered.html;
  renderResponseCommentAnchors(response.id);
  renderOutline(rendered.outline);
  bindCodeCommentButtons();
}

function renderOutline(outline: MarkdownOutlineItem[]): void {
  outlineListEl.innerHTML = "";
  if (outline.length === 0) {
    outlineListEl.innerHTML = `<div class="text-xs leading-5 text-review-muted">No headings or code blocks found.</div>`;
    return;
  }

  for (const item of outline) {
    const button = document.createElement("button");
    button.className = "rounded-md border-0 bg-transparent px-1 py-1 text-left text-xs font-medium text-review-muted hover:bg-review-accent/10 hover:text-review-accent";
    button.textContent = `${item.kind === "code" ? "▣" : "#"} ${item.label}`;
    button.addEventListener("click", () => {
      document.getElementById(item.id)?.scrollIntoView({ block: "start", behavior: "smooth" });
    });
    outlineListEl.appendChild(button);
  }
}

function bindCodeCommentButtons(): void {
  responseContentEl.querySelectorAll<HTMLButtonElement>("[data-code-comment]").forEach((button) => {
    button.addEventListener("click", () => {
      const pre = button.closest("pre");
      const code = pre?.querySelector("code")?.textContent ?? "";
      if (!code.trim()) return;
      openCommentModal({ text: code, startOffset: undefined, endOffset: undefined });
    });
  });
}

function createRangeForTextOffsets(
  root: HTMLElement,
  startOffset: number,
  endOffset: number,
): Range | null {
  if (startOffset < 0 || endOffset <= startOffset) return null;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let currentOffset = 0;
  let startNode: Text | null = null;
  let endNode: Text | null = null;
  let startNodeOffset = 0;
  let endNodeOffset = 0;
  let node = walker.nextNode() as Text | null;

  while (node) {
    const length = node.nodeValue?.length ?? 0;
    const nextOffset = currentOffset + length;

    if (!startNode && startOffset >= currentOffset && startOffset <= nextOffset) {
      startNode = node;
      startNodeOffset = startOffset - currentOffset;
    }

    if (!endNode && endOffset >= currentOffset && endOffset <= nextOffset) {
      endNode = node;
      endNodeOffset = endOffset - currentOffset;
      break;
    }

    currentOffset = nextOffset;
    node = walker.nextNode() as Text | null;
  }

  if (!startNode || !endNode) return null;

  const range = document.createRange();
  range.setStart(startNode, startNodeOffset);
  range.setEnd(endNode, endNodeOffset);
  return range.collapsed ? null : range;
}

function renderResponseCommentAnchors(responseId: string): void {
  const nextStaleCommentIds = new Set(
    [...staleCommentIds].filter((commentId) => {
      return comments.find((comment) => comment.id === commentId)?.responseId !== responseId;
    }),
  );

  const anchoredComments = comments
    .filter(
      (comment) =>
        comment.responseId === responseId &&
        comment.startOffset !== undefined &&
        comment.endOffset !== undefined,
    )
    .sort((left, right) => (right.startOffset ?? 0) - (left.startOffset ?? 0));

  for (const comment of anchoredComments) {
    const range = createRangeForTextOffsets(
      responseContentEl,
      comment.startOffset ?? 0,
      comment.endOffset ?? 0,
    );
    if (!range) {
      nextStaleCommentIds.add(comment.id);
      continue;
    }

    const marker = document.createElement("mark");
    marker.className = [
      "response-comment-anchor",
      comment.id === selectedCommentId ? "is-selected" : "",
    ].filter(Boolean).join(" ");
    marker.dataset.commentId = comment.id;
    marker.title = `${commentKindLabel(comment.kind)}: ${shortText(comment.comment, 120)}`;

    try {
      range.surroundContents(marker);
    } catch {
      marker.appendChild(range.extractContents());
      range.insertNode(marker);
    }

    marker.addEventListener("click", () => {
      selectComment(comment.id, { scrollQueue: true });
    });
  }

  staleCommentIds = nextStaleCommentIds;
}

function selectComment(
  commentId: string,
  options: { scrollQueue?: boolean } = {},
): void {
  selectedCommentId = commentId;
  renderComments();
  if (!options.scrollQueue) return;
  commentCardById.get(commentId)?.scrollIntoView({
    block: "nearest",
    behavior: "smooth",
  });
}

function renderComments(): void {
  commentListEl.innerHTML = "";
  commentCardById.clear();
  if (comments.length === 0) {
    commentListEl.innerHTML = `<div class="text-xs leading-5 text-review-muted">No comments yet. Select text in the response and press C.</div>`;
    return;
  }

  for (const comment of comments) {
    const response = responses.find((item) => item.id === comment.responseId);
    const card = document.createElement("div");
    const isSelected = selectedCommentId === comment.id;
    const staleBadge = staleCommentIds.has(comment.id)
      ? `<span class="rounded-md border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-300">Stale anchor</span>`
      : "";
    card.className = [
      "mb-2.5 rounded-xl border bg-review-panel-2 p-2.5",
      isSelected ? "border-review-accent shadow-[0_0_0_1px_rgba(88,166,255,0.35)]" : "border-review-border",
    ].join(" ");
    card.innerHTML = `
      <div class="mb-2 flex items-center justify-between gap-2">
        <div class="flex items-center gap-2 text-[11px] font-extrabold uppercase text-review-accent">
          <span>${escapeHtml(commentKindLabel(comment.kind))}</span>
          ${staleBadge}
        </div>
        <div class="flex gap-1.5">
          <button data-action="jump" class="rounded-md border border-review-border bg-review-panel-2 px-2 py-1 text-[11px] text-review-text hover:border-review-accent/60">Jump</button>
          <button data-action="edit" class="rounded-md border border-review-border bg-review-panel-2 px-2 py-1 text-[11px] text-review-text hover:border-review-accent/60">Edit</button>
          <button data-action="delete" class="rounded-md border border-review-border bg-review-panel-2 px-2 py-1 text-[11px] text-review-text hover:border-red-500/50 hover:bg-red-500/10 hover:text-red-300">Delete</button>
        </div>
      </div>
      <div class="text-xs leading-5 text-review-muted">${escapeHtml(response?.title ?? comment.responseId)}</div>
      <div class="my-2 max-h-[82px] overflow-hidden whitespace-pre-wrap border-l-2 border-review-border pl-2 text-[11px] text-review-muted">${escapeHtml(shortText(comment.selectedText, 500))}</div>
      <div class="markdown-body markdown-body-compact text-[13px] text-review-text">${renderMarkdown(comment.comment).html}</div>
    `;
    commentCardById.set(comment.id, card);
    card.addEventListener("click", () => {
      selectedCommentId = comment.id;
      renderActiveResponse();
      renderComments();
    });
    card.querySelector<HTMLButtonElement>("[data-action='jump']")?.addEventListener("click", (event) => {
      event.stopPropagation();
      jumpToComment(comment);
    });
    card.querySelector<HTMLButtonElement>("[data-action='edit']")?.addEventListener("click", (event) => {
      event.stopPropagation();
      editComment(comment);
    });
    card.querySelector<HTMLButtonElement>("[data-action='delete']")?.addEventListener("click", (event) => {
      event.stopPropagation();
      const index = comments.findIndex((item) => item.id === comment.id);
      if (index >= 0) comments.splice(index, 1);
      renderAll();
    });
    commentListEl.appendChild(card);
  }
}

function getSelectionInResponse(): PendingSelection | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;

  const range = selection.getRangeAt(0);
  if (!responseContentEl.contains(range.commonAncestorContainer)) return null;

  const text = selection.toString().trim();
  if (!text) return null;

  const preRange = range.cloneRange();
  preRange.selectNodeContents(responseContentEl);
  preRange.setEnd(range.startContainer, range.startOffset);
  const startOffset = preRange.toString().length;
  const endOffset = startOffset + selection.toString().length;

  return { text, startOffset, endOffset };
}

function isTextEntryElement(element: Element | null): boolean {
  if (!(element instanceof HTMLElement)) return false;
  return (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLSelectElement ||
    element.isContentEditable
  );
}

function isTextEntryEvent(event: KeyboardEvent): boolean {
  const pathHasTextEntry = event.composedPath().some((item) => {
    return item instanceof Element && isTextEntryElement(item);
  });
  if (pathHasTextEntry) return true;

  return isTextEntryElement(document.activeElement);
}

function commentCurrentSelection(): void {
  const selection = getSelectionInResponse();
  if (!selection) {
    flash("Select text in the response first.");
    return;
  }
  openCommentModal(selection);
}

function openCommentModal(selection: PendingSelection): void {
  pendingSelection = selection;
  editingCommentId = null;
  modalSelectionEl.textContent = selection.text;
  populateKindSelect(modalKindEl, DEFAULT_RESPONSE_REVIEW_COMMENT_KIND);
  modalCommentEl.value = "";
  modalSaveButton.textContent = "Add comment";
  modalEl.classList.add("open");
  modalCommentEl.focus();
}

function editComment(comment: ResponseReviewComment): void {
  pendingSelection = {
    text: comment.selectedText,
    startOffset: comment.startOffset,
    endOffset: comment.endOffset,
  };
  editingCommentId = comment.id;
  modalSelectionEl.textContent = comment.selectedText;
  populateKindSelect(modalKindEl, comment.kind);
  modalCommentEl.value = comment.comment;
  modalSaveButton.textContent = "Save comment";
  modalEl.classList.add("open");
  modalCommentEl.focus();
}

function closeModal(): void {
  pendingSelection = null;
  editingCommentId = null;
  modalEl.classList.remove("open");
}

function saveModalComment(): void {
  const selection = pendingSelection;
  const commentText = modalCommentEl.value.trim();
  if (!selection) return;
  if (!commentText) {
    flash("Add a comment before saving.");
    return;
  }

  if (editingCommentId) {
    const existing = comments.find((comment) => comment.id === editingCommentId);
    if (existing) {
      existing.kind = modalKindEl.value as ResponseReviewCommentKind;
      existing.comment = commentText;
    }
  } else {
    const comment: ResponseReviewComment = {
      id: `comment-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      responseId: activeResponseId,
      kind: modalKindEl.value as ResponseReviewCommentKind,
      selectedText: selection.text,
      comment: commentText,
      ...(selection.startOffset !== undefined ? { startOffset: selection.startOffset } : {}),
      ...(selection.endOffset !== undefined ? { endOffset: selection.endOffset } : {}),
    };
    comments.push(comment);
    selectedCommentId = comment.id;
  }

  closeModal();
  renderAll();
  flash("Comment added to review queue.");
}

function jumpToComment(comment: ResponseReviewComment): void {
  activeResponseId = comment.responseId;
  selectedCommentId = comment.id;
  renderAll();
  window.setTimeout(() => {
    const anchor = responseContentEl.querySelector<HTMLElement>(
      `[data-comment-id="${CSS.escape(comment.id)}"]`,
    );
    if (anchor) {
      anchor.scrollIntoView({ behavior: "smooth", block: "center" });
      anchor.classList.add("search-match");
      window.setTimeout(() => anchor.classList.remove("search-match"), 1800);
      return;
    }

    const exact = findTextElement(responseContentEl, comment.selectedText);
    if (exact) {
      exact.scrollIntoView({ behavior: "smooth", block: "center" });
      exact.classList.add("search-match");
      window.setTimeout(() => exact.classList.remove("search-match"), 1800);
      return;
    }
    responseScrollEl.scrollTo({ top: 0, behavior: "smooth" });
  }, 50);
}

function findTextElement(root: HTMLElement, text: string): HTMLElement | null {
  const needle = shortText(text, 80).toLowerCase();
  if (!needle) return null;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  let node = walker.nextNode() as HTMLElement | null;
  while (node) {
    if (["P", "PRE", "H1", "H2", "H3"].includes(node.tagName)) {
      const haystack = node.textContent?.toLowerCase() ?? "";
      if (haystack.includes(needle.slice(0, Math.min(needle.length, 40)))) return node;
    }
    node = walker.nextNode() as HTMLElement | null;
  }
  return null;
}

function renderAll(): void {
  renderResponses();
  renderActiveResponse();
  renderComments();
}

function submit(): void {
  if (submitPending) return;
  submitPending = true;
  submitButton.disabled = true;
  submitButton.textContent = "Submitting…";
  send({
    type: "submit",
    requestId: `submit-${Date.now()}`,
    activeResponseId,
    overallComment: overallCommentEl.value,
    overallCommentKind: overallKindEl.value as ResponseReviewCommentKind,
    draft: draftEl.value,
    comments: [...comments],
  });
}

function cancel(): void {
  send({ type: "cancel" });
  window.glimpse?.close();
}

window.__responseReviewReceive = (message: ResponseReviewHostMessage): void => {
  if (message.type !== "submit-ack") return;
  flash(
    `Submitted ${message.commentCount} comment${message.commentCount === 1 ? "" : "s"}${message.hasOverallComment ? " with overall feedback" : ""}.`,
  );
};

populateKindSelect(overallKindEl, DEFAULT_RESPONSE_REVIEW_COMMENT_KIND);
populateKindSelect(modalKindEl, DEFAULT_RESPONSE_REVIEW_COMMENT_KIND);

responseSearchEl.addEventListener("input", () => {
  responseFilter = responseSearchEl.value;
  renderResponses();
});

commentSelectionButton.addEventListener("click", commentCurrentSelection);

copySelectionButton.addEventListener("click", () => {
  void (async () => {
    const selection = getSelectionInResponse();
    if (!selection) {
      flash("Select text in the response first.");
      return;
    }
    await navigator.clipboard?.writeText(selection.text);
    flash("Copied selection.");
  })();
});

submitButton.addEventListener("click", submit);
cancelButton.addEventListener("click", cancel);
modalCancelButton.addEventListener("click", closeModal);
modalSaveButton.addEventListener("click", saveModalComment);
modalEl.addEventListener("click", (event) => {
  if (event.target === modalEl) closeModal();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && modalEl.classList.contains("open")) {
    closeModal();
    return;
  }

  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
    submit();
    return;
  }

  const wantsCommentShortcut =
    event.key.toLowerCase() === "c" &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.altKey &&
    !event.shiftKey;
  if (wantsCommentShortcut && !modalEl.classList.contains("open") && !isTextEntryEvent(event)) {
    const selection = getSelectionInResponse();
    if (!selection) return;
    event.preventDefault();
    openCommentModal(selection);
  }
});

renderAll();
