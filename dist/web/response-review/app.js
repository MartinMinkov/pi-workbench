(() => {
  // src/shared/contracts/review-comment-kinds.ts
  var RESPONSE_REVIEW_COMMENT_KINDS = [
    {
      value: "question",
      label: "Question",
      promptLabel: "Question",
      description: "Ask for clarification without implying a code or plan change."
    },
    {
      value: "feedback",
      label: "Feedback",
      promptLabel: "Feedback",
      description: "Request a valid change to the prior response or next action."
    },
    {
      value: "correction",
      label: "Correction",
      promptLabel: "Correction",
      description: "Correct or retract a prior statement, assumption, plan, or suggestion."
    },
    {
      value: "preference",
      label: "Preference",
      promptLabel: "Preference",
      description: "Adapt approach, tone, structure, or tradeoff to a stated preference."
    },
    {
      value: "follow-up",
      label: "Follow-up",
      promptLabel: "Follow-up",
      description: "Expand on a point or continue an investigation."
    }
  ];
  var DEFAULT_RESPONSE_REVIEW_COMMENT_KIND = "question";
  function getReviewCommentKindLabel(definitions, kind, fallback) {
    return (definitions.find((definition) => definition.value === (kind ?? fallback)) ?? definitions.find((definition) => definition.value === fallback) ?? definitions[0]).label;
  }
  // src/shared/web/markdown.ts
  function escapeHtml(value) {
    return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function renderMarkdown(markdown, options = {}) {
    const outline = [];
    const lines = markdown.replace(/\r\n?/g, `
`).split(`
`);
    const html = [];
    let index = 0;
    let outlineIndex = 0;
    const idPrefix = options.outlineIdPrefix ?? "outline";
    const needsBlockIds = options.includeOutline || options.codeCommentButtons;
    const nextOutlineId = () => `${idPrefix}-${outlineIndex++}`;
    while (index < lines.length) {
      const line = lines[index] ?? "";
      if (line.trim() === "") {
        index += 1;
        continue;
      }
      const fence = line.match(/^\s*(`{3,}|~{3,})\s*([^`]*)$/);
      if (fence) {
        const marker = fence[1] ?? "```";
        const language = (fence[2] ?? "").trim();
        const codeLines = [];
        index += 1;
        while (index < lines.length) {
          const candidate = lines[index] ?? "";
          if (new RegExp(`^\\s*${escapeRegExp(marker[0] ?? "`")}{${marker.length},}\\s*$`).test(candidate)) {
            index += 1;
            break;
          }
          codeLines.push(candidate);
          index += 1;
        }
        const id = needsBlockIds ? nextOutlineId() : "";
        if (options.includeOutline) {
          outline.push({ id, label: language ? `Code · ${language}` : "Code block", kind: "code", language });
        }
        const languageLabel = language ? `<span class="code-language">${escapeHtml(language)}</span>` : "";
        const commentButton = options.codeCommentButtons ? `<button class="code-comment-button" data-code-comment="${id}">Comment block</button>` : "";
        const preId = id ? ` id="${id}"` : "";
        html.push(`<pre${preId}>${languageLabel}${commentButton}<code>${escapeHtml(codeLines.join(`
`))}</code></pre>`);
        continue;
      }
      const heading = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
      if (heading) {
        const level = heading[1]?.length ?? 2;
        const label = heading[2]?.trim() ?? "Heading";
        const id = options.includeOutline ? nextOutlineId() : "";
        if (options.includeOutline) {
          outline.push({ id, label: stripInlineMarkdown(label), kind: "heading", level });
        }
        const headingId = id ? ` id="${id}"` : "";
        html.push(`<h${level}${headingId}>${renderInlineMarkdown(label)}</h${level}>`);
        index += 1;
        continue;
      }
      if (/^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/.test(line)) {
        html.push("<hr />");
        index += 1;
        continue;
      }
      const table = readTable(lines, index);
      if (table) {
        html.push(renderTable(table.headers, table.rows));
        index = table.nextIndex;
        continue;
      }
      if (isListLine(line)) {
        const block = [];
        while (index < lines.length && isListLine(lines[index] ?? "")) {
          block.push(lines[index] ?? "");
          index += 1;
        }
        html.push(renderListBlock(block));
        continue;
      }
      if (/^>\s?/.test(line)) {
        const quoteLines = [];
        while (index < lines.length && /^>\s?/.test(lines[index] ?? "")) {
          quoteLines.push((lines[index] ?? "").replace(/^>\s?/, ""));
          index += 1;
        }
        html.push(`<blockquote>${renderMarkdown(quoteLines.join(`
`)).html}</blockquote>`);
        continue;
      }
      const paragraph = [];
      while (index < lines.length && !startsBlock(lines, index)) {
        paragraph.push(lines[index] ?? "");
        index += 1;
      }
      html.push(`<p>${renderInlineMarkdown(paragraph.join(`
`))}</p>`);
    }
    return { html: html.join(`
`), outline };
  }
  function renderInlineMarkdown(value) {
    const codeSpans = [];
    const withoutCode = value.replace(/`([^`]+)`/g, (_match, code) => {
      const token = `\x00CODE${codeSpans.length}\x00`;
      codeSpans.push(`<code>${escapeHtml(code)}</code>`);
      return token;
    });
    let html = escapeHtml(withoutCode).replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)<>"']+)\)/g, (_match, label, href) => `<a href="${escapeHtml(href)}" target="_blank" rel="noreferrer">${label}</a>`).replace(/(\*\*|__)(.+?)\1/g, "<strong>$2</strong>").replace(/(\*|_)([^*_]+?)\1/g, "<em>$2</em>").replace(/~~(.+?)~~/g, "<del>$1</del>").replace(/\n/g, "<br />");
    codeSpans.forEach((code, codeIndex) => {
      html = html.replace(`\x00CODE${codeIndex}\x00`, code);
    });
    return html;
  }
  function startsBlock(lines, index) {
    const line = lines[index] ?? "";
    if (line.trim() === "")
      return true;
    if (/^\s*(`{3,}|~{3,})/.test(line))
      return true;
    if (/^(#{1,6})\s+/.test(line))
      return true;
    if (/^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/.test(line))
      return true;
    if (/^>\s?/.test(line))
      return true;
    if (isListLine(line))
      return true;
    return Boolean(readTable(lines, index));
  }
  function isListLine(line) {
    return /^\s{0,12}(?:[-*+]\s+|\d+[.)]\s+)/.test(line);
  }
  function parseListLine(line) {
    const match = line.match(/^(\s{0,12})([-*+]|\d+[.)])\s+(.+)$/);
    if (!match)
      return null;
    return {
      indent: match[1]?.replace(/\t/g, "    ").length ?? 0,
      ordered: /^\d/.test(match[2] ?? ""),
      text: match[3] ?? ""
    };
  }
  function renderListBlock(lines) {
    const parsed = lines.map(parseListLine).filter((line) => line !== null);
    const [html] = renderListAt(parsed, 0, parsed[0]?.indent ?? 0, parsed[0]?.ordered ?? false);
    return html;
  }
  function renderListAt(lines, start, indent, ordered) {
    const tag = ordered ? "ol" : "ul";
    const items = [];
    let index = start;
    while (index < lines.length) {
      const item = lines[index];
      if (!item || item.indent < indent)
        break;
      if (item.indent > indent)
        break;
      if (item.ordered !== ordered)
        break;
      index += 1;
      let body = renderTaskListItem(item.text);
      while (index < lines.length && (lines[index]?.indent ?? 0) > indent) {
        const nested = lines[index];
        if (!nested)
          break;
        const [nestedHtml, nextIndex] = renderListAt(lines, index, nested.indent, nested.ordered);
        body += nestedHtml;
        index = nextIndex;
      }
      items.push(`<li>${body}</li>`);
    }
    return [`<${tag}>${items.join("")}</${tag}>`, index];
  }
  function renderTaskListItem(text) {
    const task = text.match(/^\[([ xX])]\s+(.+)$/);
    if (!task)
      return renderInlineMarkdown(text);
    const checked = task[1]?.toLowerCase() === "x";
    const label = renderInlineMarkdown(task[2] ?? "");
    return `<input type="checkbox" disabled${checked ? " checked" : ""} /> ${label}`;
  }
  function readTable(lines, start) {
    const header = lines[start] ?? "";
    const delimiter = lines[start + 1] ?? "";
    if (!header.includes("|") || !/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(delimiter)) {
      return null;
    }
    const headers = splitTableRow(header);
    const rows = [];
    let index = start + 2;
    while (index < lines.length && (lines[index] ?? "").includes("|")) {
      rows.push(splitTableRow(lines[index] ?? ""));
      index += 1;
    }
    return { headers, rows, nextIndex: index };
  }
  function splitTableRow(line) {
    return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
  }
  function renderTable(headers, rows) {
    const headerHtml = headers.map((header) => `<th>${renderInlineMarkdown(header)}</th>`).join("");
    const bodyHtml = rows.map((row) => `<tr>${row.map((cell) => `<td>${renderInlineMarkdown(cell)}</td>`).join("")}</tr>`).join("");
    return `<table><thead><tr>${headerHtml}</tr></thead><tbody>${bodyHtml}</tbody></table>`;
  }
  function stripInlineMarkdown(value) {
    return value.replace(/`([^`]+)`/g, "$1").replace(/\[([^\]]+)]\([^)]*\)/g, "$1").replace(/(\*\*|__)(.+?)\1/g, "$2").replace(/(\*|_)([^*_]+?)\1/g, "$2").replace(/~~(.+?)~~/g, "$1");
  }
  function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  // src/features/response-review/web/main.ts
  var data = JSON.parse(document.getElementById("response-review-data")?.textContent ?? "{}");
  var responses = data.responses ?? [];
  var comments = [];
  var activeResponseId = data.initialResponseId ?? responses.at(-1)?.id ?? responses[0]?.id ?? "";
  var responseFilter = "";
  var pendingSelection = null;
  var editingCommentId = null;
  var submitPending = false;
  var responseListEl = requireElement("response-list");
  var outlineListEl = requireElement("outline-list");
  var responseContentEl = requireElement("response-content");
  var responseScrollEl = requireElement("response-scroll");
  var activeTitleEl = requireElement("active-title");
  var activeMetaEl = requireElement("active-meta");
  var responseSearchEl = requireElement("response-search");
  var commentSelectionButton = requireElement("comment-selection-button");
  var copySelectionButton = requireElement("copy-selection-button");
  var commentListEl = requireElement("comment-list");
  var overallCommentEl = requireElement("overall-comment");
  var overallKindEl = requireElement("overall-kind");
  var draftEl = requireElement("draft");
  var submitButton = requireElement("submit-button");
  var cancelButton = requireElement("cancel-button");
  var statusEl = requireElement("status");
  var modalEl = requireElement("comment-modal");
  var modalSelectionEl = requireElement("modal-selection");
  var modalKindEl = requireElement("modal-kind");
  var modalCommentEl = requireElement("modal-comment");
  var modalCancelButton = requireElement("modal-cancel");
  var modalSaveButton = requireElement("modal-save");
  var commentCardById = new Map;
  var selectedCommentId = null;
  var staleCommentIds = new Set;
  function requireElement(id) {
    const element = document.getElementById(id);
    if (!element)
      throw new Error(`Missing #${id}`);
    return element;
  }
  function activeResponse() {
    return responses.find((response) => response.id === activeResponseId) ?? responses.at(-1);
  }
  function commentKindLabel(kind) {
    return getReviewCommentKindLabel(RESPONSE_REVIEW_COMMENT_KINDS, kind, DEFAULT_RESPONSE_REVIEW_COMMENT_KIND);
  }
  function renderKindOptions(selectedKind) {
    return RESPONSE_REVIEW_COMMENT_KINDS.map((definition) => {
      const selected = definition.value === selectedKind ? " selected" : "";
      return `<option value="${escapeHtml(definition.value)}" title="${escapeHtml(definition.description)}"${selected}>${escapeHtml(definition.label)}</option>`;
    }).join("");
  }
  function populateKindSelect(select, selectedKind) {
    select.innerHTML = renderKindOptions(selectedKind);
    select.value = selectedKind;
  }
  function shortText(value, max = 220) {
    const normalized = value.replace(/\s+/g, " ").trim();
    return normalized.length > max ? `${normalized.slice(0, max - 1)}…` : normalized;
  }
  function send(message) {
    if (window.glimpse) {
      window.glimpse.send(message);
      return;
    }
    console.log("response-review message", message);
  }
  function flash(message) {
    statusEl.textContent = message;
    window.setTimeout(() => {
      if (statusEl.textContent === message)
        statusEl.textContent = "";
    }, 2200);
  }
  function renderResponses() {
    const filtered = responses.filter((response) => {
      if (!responseFilter)
        return true;
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
        response.id === activeResponseId ? "border-review-accent shadow-[inset_3px_0_0_#58a6ff]" : "border-review-border"
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
  function renderActiveResponse() {
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
      codeCommentButtons: true
    });
    responseContentEl.innerHTML = rendered.html;
    renderResponseCommentAnchors(response.id);
    renderOutline(rendered.outline);
    bindCodeCommentButtons();
  }
  function renderOutline(outline) {
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
  function bindCodeCommentButtons() {
    responseContentEl.querySelectorAll("[data-code-comment]").forEach((button) => {
      button.addEventListener("click", () => {
        const pre = button.closest("pre");
        const code = pre?.querySelector("code")?.textContent ?? "";
        if (!code.trim())
          return;
        openCommentModal({ text: code, startOffset: undefined, endOffset: undefined });
      });
    });
  }
  function createRangeForTextOffsets(root, startOffset, endOffset) {
    if (startOffset < 0 || endOffset <= startOffset)
      return null;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let currentOffset = 0;
    let startNode = null;
    let endNode = null;
    let startNodeOffset = 0;
    let endNodeOffset = 0;
    let node = walker.nextNode();
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
      node = walker.nextNode();
    }
    if (!startNode || !endNode)
      return null;
    const range = document.createRange();
    range.setStart(startNode, startNodeOffset);
    range.setEnd(endNode, endNodeOffset);
    return range.collapsed ? null : range;
  }
  function renderResponseCommentAnchors(responseId) {
    const nextStaleCommentIds = new Set([...staleCommentIds].filter((commentId) => {
      return comments.find((comment) => comment.id === commentId)?.responseId !== responseId;
    }));
    const anchoredComments = comments.filter((comment) => comment.responseId === responseId && comment.startOffset !== undefined && comment.endOffset !== undefined).sort((left, right) => (right.startOffset ?? 0) - (left.startOffset ?? 0));
    for (const comment of anchoredComments) {
      const range = createRangeForTextOffsets(responseContentEl, comment.startOffset ?? 0, comment.endOffset ?? 0);
      if (!range) {
        nextStaleCommentIds.add(comment.id);
        continue;
      }
      const marker = document.createElement("mark");
      marker.className = [
        "response-comment-anchor",
        comment.id === selectedCommentId ? "is-selected" : ""
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
  function selectComment(commentId, options = {}) {
    selectedCommentId = commentId;
    renderComments();
    if (!options.scrollQueue)
      return;
    commentCardById.get(commentId)?.scrollIntoView({
      block: "nearest",
      behavior: "smooth"
    });
  }
  function renderComments() {
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
      const staleBadge = staleCommentIds.has(comment.id) ? `<span class="rounded-md border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-300">Stale anchor</span>` : "";
      card.className = [
        "mb-2.5 rounded-xl border bg-review-panel-2 p-2.5",
        isSelected ? "border-review-accent shadow-[0_0_0_1px_rgba(88,166,255,0.35)]" : "border-review-border"
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
      card.querySelector("[data-action='jump']")?.addEventListener("click", (event) => {
        event.stopPropagation();
        jumpToComment(comment);
      });
      card.querySelector("[data-action='edit']")?.addEventListener("click", (event) => {
        event.stopPropagation();
        editComment(comment);
      });
      card.querySelector("[data-action='delete']")?.addEventListener("click", (event) => {
        event.stopPropagation();
        const index = comments.findIndex((item) => item.id === comment.id);
        if (index >= 0)
          comments.splice(index, 1);
        renderAll();
      });
      commentListEl.appendChild(card);
    }
  }
  function getSelectionInResponse() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed)
      return null;
    const range = selection.getRangeAt(0);
    if (!responseContentEl.contains(range.commonAncestorContainer))
      return null;
    const text = selection.toString().trim();
    if (!text)
      return null;
    const preRange = range.cloneRange();
    preRange.selectNodeContents(responseContentEl);
    preRange.setEnd(range.startContainer, range.startOffset);
    const startOffset = preRange.toString().length;
    const endOffset = startOffset + selection.toString().length;
    return { text, startOffset, endOffset };
  }
  function isTextEntryElement(element) {
    if (!(element instanceof HTMLElement))
      return false;
    return element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement || element.isContentEditable;
  }
  function isTextEntryEvent(event) {
    const pathHasTextEntry = event.composedPath().some((item) => {
      return item instanceof Element && isTextEntryElement(item);
    });
    if (pathHasTextEntry)
      return true;
    return isTextEntryElement(document.activeElement);
  }
  function commentCurrentSelection() {
    const selection = getSelectionInResponse();
    if (!selection) {
      flash("Select text in the response first.");
      return;
    }
    openCommentModal(selection);
  }
  function openCommentModal(selection) {
    pendingSelection = selection;
    editingCommentId = null;
    modalSelectionEl.textContent = selection.text;
    populateKindSelect(modalKindEl, DEFAULT_RESPONSE_REVIEW_COMMENT_KIND);
    modalCommentEl.value = "";
    modalSaveButton.textContent = "Add comment";
    modalEl.classList.add("open");
    modalCommentEl.focus();
  }
  function editComment(comment) {
    pendingSelection = {
      text: comment.selectedText,
      startOffset: comment.startOffset,
      endOffset: comment.endOffset
    };
    editingCommentId = comment.id;
    modalSelectionEl.textContent = comment.selectedText;
    populateKindSelect(modalKindEl, comment.kind);
    modalCommentEl.value = comment.comment;
    modalSaveButton.textContent = "Save comment";
    modalEl.classList.add("open");
    modalCommentEl.focus();
  }
  function closeModal() {
    pendingSelection = null;
    editingCommentId = null;
    modalEl.classList.remove("open");
  }
  function saveModalComment() {
    const selection = pendingSelection;
    const commentText = modalCommentEl.value.trim();
    if (!selection)
      return;
    if (!commentText) {
      flash("Add a comment before saving.");
      return;
    }
    if (editingCommentId) {
      const existing = comments.find((comment) => comment.id === editingCommentId);
      if (existing) {
        existing.kind = modalKindEl.value;
        existing.comment = commentText;
      }
    } else {
      const comment = {
        id: `comment-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        responseId: activeResponseId,
        kind: modalKindEl.value,
        selectedText: selection.text,
        comment: commentText,
        ...selection.startOffset !== undefined ? { startOffset: selection.startOffset } : {},
        ...selection.endOffset !== undefined ? { endOffset: selection.endOffset } : {}
      };
      comments.push(comment);
      selectedCommentId = comment.id;
    }
    closeModal();
    renderAll();
    flash("Comment added to review queue.");
  }
  function jumpToComment(comment) {
    activeResponseId = comment.responseId;
    selectedCommentId = comment.id;
    renderAll();
    window.setTimeout(() => {
      const anchor = responseContentEl.querySelector(`[data-comment-id="${CSS.escape(comment.id)}"]`);
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
  function findTextElement(root, text) {
    const needle = shortText(text, 80).toLowerCase();
    if (!needle)
      return null;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    let node = walker.nextNode();
    while (node) {
      if (["P", "PRE", "H1", "H2", "H3"].includes(node.tagName)) {
        const haystack = node.textContent?.toLowerCase() ?? "";
        if (haystack.includes(needle.slice(0, Math.min(needle.length, 40))))
          return node;
      }
      node = walker.nextNode();
    }
    return null;
  }
  function renderAll() {
    renderResponses();
    renderActiveResponse();
    renderComments();
  }
  function submit() {
    if (submitPending)
      return;
    submitPending = true;
    submitButton.disabled = true;
    submitButton.textContent = "Submitting…";
    send({
      type: "submit",
      requestId: `submit-${Date.now()}`,
      activeResponseId,
      overallComment: overallCommentEl.value,
      overallCommentKind: overallKindEl.value,
      draft: draftEl.value,
      comments: [...comments]
    });
  }
  function cancel() {
    send({ type: "cancel" });
    window.glimpse?.close();
  }
  window.__responseReviewReceive = (message) => {
    if (message.type !== "submit-ack")
      return;
    flash(`Submitted ${message.commentCount} comment${message.commentCount === 1 ? "" : "s"}${message.hasOverallComment ? " with overall feedback" : ""}.`);
  };
  populateKindSelect(overallKindEl, DEFAULT_RESPONSE_REVIEW_COMMENT_KIND);
  populateKindSelect(modalKindEl, DEFAULT_RESPONSE_REVIEW_COMMENT_KIND);
  responseSearchEl.addEventListener("input", () => {
    responseFilter = responseSearchEl.value;
    renderResponses();
  });
  commentSelectionButton.addEventListener("click", commentCurrentSelection);
  copySelectionButton.addEventListener("click", () => {
    (async () => {
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
    if (event.target === modalEl)
      closeModal();
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
    const wantsCommentShortcut = event.key.toLowerCase() === "c" && !event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey;
    if (wantsCommentShortcut && !modalEl.classList.contains("open") && !isTextEntryEvent(event)) {
      const selection = getSelectionInResponse();
      if (!selection)
        return;
      event.preventDefault();
      openCommentModal(selection);
    }
  });
  renderAll();
})();
