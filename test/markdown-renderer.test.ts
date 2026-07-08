import { describe, expect, it } from "bun:test";

import { renderMarkdown } from "../src/shared/web/markdown.ts";

describe("renderMarkdown", () => {
  it("renders common Markdown blocks instead of plain pre-wrapped text", () => {
    const rendered = renderMarkdown(`- parent
  - child
- [x] done

| Key | Value |
| --- | --- |
| **A** | \`code\` |`);

    expect(rendered.html).toContain("<ul>");
    expect(rendered.html).toContain("<li>parent<ul><li>child</li></ul></li>");
    expect(rendered.html).toContain('<input type="checkbox" disabled checked /> done');
    expect(rendered.html).toContain("<table>");
    expect(rendered.html).toContain("<strong>A</strong>");
    expect(rendered.html).toContain("<code>code</code>");
  });

  it("escapes fenced code and exposes code block outline entries", () => {
    const rendered = renderMarkdown("## Example\n\n```ts\nconst x = '<script>';\n```", {
      includeOutline: true,
      codeCommentButtons: true,
    });

    expect(rendered.outline).toEqual([
      { id: "outline-0", label: "Example", kind: "heading", level: 2 },
      { id: "outline-1", label: "Code · ts", kind: "code", language: "ts" },
    ]);
    expect(rendered.html).toContain("<h2 id=\"outline-0\">Example</h2>");
    expect(rendered.html).toContain("data-code-comment=\"outline-1\"");
    expect(rendered.html).toContain("&lt;script&gt;");
    expect(rendered.html).not.toContain("<script>");
  });

  it("omits repeated block ids when no outline or code actions need them", () => {
    const rendered = renderMarkdown("## Comment\n\n```ts\nconst value = 1;\n```");

    expect(rendered.html).toContain("<h2>Comment</h2>");
    expect(rendered.html).toContain('<span class="code-language">ts</span>');
    expect(rendered.html).toContain("<code>const value = 1;</code>");
    expect(rendered.html).not.toMatch(/<pre[^>]*id="outline-/);
    expect(rendered.outline).toEqual([]);
  });

  it("escapes raw HTML and blocks non-http links", () => {
    const rendered = renderMarkdown(
      "<script>alert(1)</script> [safe](https://example.com?a=1) [bad](javascript:alert(1))",
    );

    expect(rendered.html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(rendered.html).toContain(
      '<a href="https://example.com?a=1" target="_blank" rel="noreferrer">safe</a>',
    );
    expect(rendered.html).toContain("[bad](javascript:alert(1))");
    expect(rendered.html).not.toContain("href=\"javascript:");
  });
});
