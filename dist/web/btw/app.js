(() => {
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

  // src/features/btw/web/main.ts
  var state = JSON.parse(document.getElementById("btw-data")?.textContent ?? "{}");
  var titleEl = must("title");
  var subtitleEl = must("subtitle");
  var transcriptEl = must("transcript");
  var statusEl = must("status");
  var composerEl = must("composer");
  var threadSummaryEl = must("thread-summary");
  var modelInputEl = must("model-input");
  var thinkingInputEl = must("thinking-input");
  function must(id) {
    const element = document.getElementById(id);
    if (!element)
      throw new Error(`Missing #${id}`);
    return element;
  }
  function send(message) {
    window.glimpse?.send(message);
  }
  function textPreview(value, max = 500) {
    return value.length > max ? `${value.slice(0, max - 1)}…` : value;
  }
  function entryHtml(entry) {
    switch (entry.type) {
      case "turn-boundary":
        return entry.phase === "start" ? `<div class="my-5 border-t border-review-border"></div>` : "";
      case "user-message":
        return `
        <div class="mb-4">
          <div class="mb-1 text-[11px] font-extrabold uppercase text-review-accent">You</div>
          <div class="markdown-body markdown-body-compact rounded-xl border border-review-border bg-review-panel-2 p-3 text-sm leading-6">${renderMarkdown(entry.text).html}</div>
        </div>`;
      case "thinking":
        return `
        <div class="mb-4 opacity-90">
          <div class="mb-1 text-[11px] font-extrabold uppercase text-yellow-400">Thinking ${entry.streaming ? "▍" : ""}</div>
          <div class="whitespace-pre-wrap border-l-2 border-yellow-500/50 pl-3 text-sm italic leading-6 text-yellow-100/80">${escapeHtml(textPreview(entry.text, 1600))}</div>
        </div>`;
      case "assistant-text":
        return `
        <div class="mb-4">
          <div class="mb-1 text-[11px] font-extrabold uppercase text-green-400">Assistant ${entry.streaming ? "▍" : ""}</div>
          <div class="markdown-body markdown-body-compact rounded-xl border border-review-border bg-[#0f141b] p-3 text-sm leading-6">${renderMarkdown(entry.text).html}</div>
        </div>`;
      case "tool-call":
        return `
        <div class="mb-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-2 text-xs">
          <span class="font-bold text-yellow-300">Tool</span>
          <span class="font-bold"> ${escapeHtml(entry.toolName)}</span>
          <span class="text-review-muted"> ${escapeHtml(entry.args)}</span>
        </div>`;
      case "tool-result":
        return `
        <div class="mb-3 ml-4 rounded-lg border ${entry.isError ? "border-red-500/40 bg-red-500/10" : "border-review-border bg-review-panel-2"} p-2 text-xs">
          <div class="mb-1 font-bold ${entry.isError ? "text-red-300" : "text-review-muted"}">↳ ${entry.streaming ? "streaming result" : "result"}${entry.truncated ? " (truncated)" : ""}</div>
          <pre class="whitespace-pre-wrap font-mono leading-5 ${entry.isError ? "text-red-200" : "text-review-muted"}">${escapeHtml(entry.content)}</pre>
        </div>`;
    }
  }
  function render() {
    titleEl.textContent = state.mode === "tangent" ? "BTW tangent" : "BTW";
    subtitleEl.textContent = state.mode === "tangent" ? "Contextless side conversation" : "Parallel side conversation with main-session context";
    statusEl.textContent = state.status ?? "Ready. Ask a side question.";
    threadSummaryEl.innerHTML = `
    <div>${state.completedExchanges} exchange${state.completedExchanges === 1 ? "" : "s"}</div>
    <div class="mt-1 text-review-muted">${state.streaming ? "Streaming" : "Idle"}</div>
    <div class="mt-3 text-review-muted">Mode: ${escapeHtml(state.mode)}</div>
    <div class="mt-3 text-review-muted">Model: ${escapeHtml(state.modelOverride ? `${state.modelOverride.provider}/${state.modelOverride.id}` : "inherits main")}</div>
    <div class="mt-1 text-review-muted">Thinking: ${escapeHtml(state.thinkingOverride ?? "inherits main")}</div>
  `;
    if (document.activeElement !== composerEl && composerEl.value !== state.draft) {
      composerEl.value = state.draft;
    }
    transcriptEl.innerHTML = state.entries.length ? state.entries.map(entryHtml).join(`
`) : `<div class="mx-auto mt-16 max-w-xl rounded-xl border border-review-border bg-review-panel-2 p-6 text-center text-review-muted">No BTW thread yet. Ask a side question to start one.</div>`;
    transcriptEl.scrollTop = transcriptEl.scrollHeight;
  }
  function submitComposer() {
    const value = composerEl.value.trim();
    if (!value)
      return;
    send({ type: "submit", value });
  }
  function sendCommand(name, args = "") {
    send({ type: "command", name, args });
  }
  composerEl.addEventListener("input", () => send({ type: "set-draft", value: composerEl.value }));
  composerEl.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submitComposer();
    }
    if (event.key === "Escape") {
      send({ type: "close" });
    }
  });
  must("send-button").addEventListener("click", submitComposer);
  must("close-button").addEventListener("click", () => send({ type: "close" }));
  must("new-button").addEventListener("click", () => sendCommand("btw:new"));
  must("tangent-button").addEventListener("click", () => sendCommand("btw:tangent"));
  must("inject-button").addEventListener("click", () => sendCommand("btw:inject"));
  must("summarize-button").addEventListener("click", () => sendCommand("btw:summarize"));
  must("clear-button").addEventListener("click", () => sendCommand("btw:clear"));
  must("model-set-button").addEventListener("click", () => sendCommand("btw:model", modelInputEl.value));
  must("model-clear-button").addEventListener("click", () => sendCommand("btw:model", "clear"));
  must("thinking-set-button").addEventListener("click", () => sendCommand("btw:thinking", thinkingInputEl.value));
  must("thinking-clear-button").addEventListener("click", () => sendCommand("btw:thinking", "clear"));
  window.__btwReceive = (message) => {
    if (message.type !== "state")
      return;
    state = message.state;
    render();
  };
  render();
  composerEl.focus();
})();
