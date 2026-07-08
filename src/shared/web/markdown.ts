export type MarkdownOutlineItem = {
  id: string;
  label: string;
  kind: "heading" | "code";
  level?: number;
  language?: string;
};

export type RenderMarkdownOptions = {
  includeOutline?: boolean;
  outlineIdPrefix?: string;
  codeCommentButtons?: boolean;
};

export type RenderMarkdownResult = {
  html: string;
  outline: MarkdownOutlineItem[];
};

type ListLine = {
  indent: number;
  ordered: boolean;
  text: string;
};

export function escapeHtml(value: unknown): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderMarkdown(
  markdown: string,
  options: RenderMarkdownOptions = {},
): RenderMarkdownResult {
  const outline: MarkdownOutlineItem[] = [];
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const html: string[] = [];
  let index = 0;
  let outlineIndex = 0;
  const idPrefix = options.outlineIdPrefix ?? "outline";
  const needsBlockIds = options.includeOutline || options.codeCommentButtons;

  const nextOutlineId = (): string => `${idPrefix}-${outlineIndex++}`;

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
      const codeLines: string[] = [];
      const fenceCharacter = marker.startsWith("~") ? "~" : "`";
      const closingFencePattern = new RegExp(
        `^\\s*${escapeRegExp(fenceCharacter)}{${marker.length},}\\s*$`,
      );
      index += 1;
      while (index < lines.length) {
        const candidate = lines[index] ?? "";
        if (closingFencePattern.test(candidate)) {
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
      const languageLabel = language
        ? `<span class="code-language">${escapeHtml(language)}</span>`
        : "";
      const commentButton = options.codeCommentButtons
        ? `<button class="code-comment-button" data-code-comment="${id}">Comment block</button>`
        : "";
      const preId = id ? ` id="${id}"` : "";
      html.push(
        `<pre${preId}>${languageLabel}${commentButton}<code>${escapeHtml(codeLines.join("\n"))}</code></pre>`,
      );
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
      const block: string[] = [];
      while (index < lines.length && isListLine(lines[index] ?? "")) {
        block.push(lines[index] ?? "");
        index += 1;
      }
      html.push(renderListBlock(block));
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quoteLines: string[] = [];
      while (index < lines.length && /^>\s?/.test(lines[index] ?? "")) {
        quoteLines.push((lines[index] ?? "").replace(/^>\s?/, ""));
        index += 1;
      }
      html.push(`<blockquote>${renderMarkdown(quoteLines.join("\n")).html}</blockquote>`);
      continue;
    }

    const paragraph: string[] = [];
    while (index < lines.length && !startsBlock(lines, index)) {
      paragraph.push(lines[index] ?? "");
      index += 1;
    }
    html.push(`<p>${renderInlineMarkdown(paragraph.join("\n"))}</p>`);
  }

  return { html: html.join("\n"), outline };
}

export function renderInlineMarkdown(value: string): string {
  const codeSpans: string[] = [];
  const withoutCode = value.replace(/`([^`]+)`/g, (_match, code: string) => {
    const token = `\u0000CODE${codeSpans.length}\u0000`;
    codeSpans.push(`<code>${escapeHtml(code)}</code>`);
    return token;
  });

  let html = escapeHtml(withoutCode)
    .replace(
      /\[([^\]\n]+)\]\((https?:\/\/[^\s)<>"']+)\)/g,
      (_match, label: string, href: string) =>
        `<a href="${escapeHtml(href)}" target="_blank" rel="noreferrer">${label}</a>`,
    )
    .replace(/(\*\*|__)(.+?)\1/g, "<strong>$2</strong>")
    .replace(/(\*|_)([^*_]+?)\1/g, "<em>$2</em>")
    .replace(/~~(.+?)~~/g, "<del>$1</del>")
    .replace(/\n/g, "<br />");

  codeSpans.forEach((code, codeIndex) => {
    html = html.replace(`\u0000CODE${codeIndex}\u0000`, code);
  });

  return html;
}

function startsBlock(lines: string[], index: number): boolean {
  const line = lines[index] ?? "";
  if (line.trim() === "") return true;
  if (/^\s*(`{3,}|~{3,})/.test(line)) return true;
  if (/^(#{1,6})\s+/.test(line)) return true;
  if (/^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/.test(line)) return true;
  if (/^>\s?/.test(line)) return true;
  if (isListLine(line)) return true;
  return Boolean(readTable(lines, index));
}

function isListLine(line: string): boolean {
  return /^\s{0,12}(?:[-*+]\s+|\d+[.)]\s+)/.test(line);
}

function parseListLine(line: string): ListLine | null {
  const match = line.match(/^(\s{0,12})([-*+]|\d+[.)])\s+(.+)$/);
  if (!match) return null;
  return {
    indent: match[1]?.replace(/\t/g, "    ").length ?? 0,
    ordered: /^\d/.test(match[2] ?? ""),
    text: match[3] ?? "",
  };
}

function renderListBlock(lines: string[]): string {
  const parsed = lines.map(parseListLine).filter((line): line is ListLine => line !== null);
  const [html] = renderListAt(parsed, 0, parsed[0]?.indent ?? 0, parsed[0]?.ordered ?? false);
  return html;
}

function renderListAt(
  lines: ListLine[],
  start: number,
  indent: number,
  ordered: boolean,
): [string, number] {
  const tag = ordered ? "ol" : "ul";
  const items: string[] = [];
  let index = start;

  while (index < lines.length) {
    const item = lines[index];
    if (!item || item.indent < indent) break;
    if (item.indent > indent) break;
    if (item.ordered !== ordered) break;

    index += 1;
    let body = renderTaskListItem(item.text);
    while (index < lines.length && (lines[index]?.indent ?? 0) > indent) {
      const nested = lines[index];
      if (!nested) break;
      const [nestedHtml, nextIndex] = renderListAt(lines, index, nested.indent, nested.ordered);
      body += nestedHtml;
      index = nextIndex;
    }
    items.push(`<li>${body}</li>`);
  }

  return [`<${tag}>${items.join("")}</${tag}>`, index];
}

function renderTaskListItem(text: string): string {
  const task = text.match(/^\[([ xX])]\s+(.+)$/);
  if (!task) return renderInlineMarkdown(text);

  const checked = task[1]?.toLowerCase() === "x";
  const label = renderInlineMarkdown(task[2] ?? "");
  return `<input type="checkbox" disabled${checked ? " checked" : ""} /> ${label}`;
}

function readTable(
  lines: string[],
  start: number,
): { headers: string[]; rows: string[][]; nextIndex: number } | null {
  const header = lines[start] ?? "";
  const delimiter = lines[start + 1] ?? "";
  if (!header.includes("|") || !/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(delimiter)) {
    return null;
  }

  const headers = splitTableRow(header);
  const rows: string[][] = [];
  let index = start + 2;
  while (index < lines.length && (lines[index] ?? "").includes("|")) {
    rows.push(splitTableRow(lines[index] ?? ""));
    index += 1;
  }

  return { headers, rows, nextIndex: index };
}

function splitTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function renderTable(headers: string[], rows: string[][]): string {
  const headerHtml = headers.map((header) => `<th>${renderInlineMarkdown(header)}</th>`).join("");
  const bodyHtml = rows
    .map((row) => `<tr>${row.map((cell) => `<td>${renderInlineMarkdown(cell)}</td>`).join("")}</tr>`)
    .join("");
  return `<table><thead><tr>${headerHtml}</tr></thead><tbody>${bodyHtml}</tbody></table>`;
}

function stripInlineMarkdown(value: string): string {
  return value
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/(\*\*|__)(.+?)\1/g, "$2")
    .replace(/(\*|_)([^*_]+?)\1/g, "$2")
    .replace(/~~(.+?)~~/g, "$1");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
