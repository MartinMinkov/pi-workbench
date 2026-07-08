import { describe, expect, it } from "bun:test";

import { buildInlineWebAppHtml } from "../src/shared/host/html.ts";

describe("buildInlineWebAppHtml", () => {
  it("inlines JavaScript literally instead of applying replacement tokens", () => {
    const html = buildInlineWebAppHtml("diff-review", { repoRoot: "$&", files: [], goModules: [] });
    const scriptStart = html.indexOf("(() =>");
    const scriptEnd = html.indexOf("</script>", scriptStart);

    expect(scriptStart).toBeGreaterThan(0);
    expect(scriptEnd).toBeGreaterThan(scriptStart);

    const script = html.slice(scriptStart, scriptEnd);
    expect(script).toContain("setupMonaco();");
    expect(script).not.toContain("<title>pi review</title>");
    expect(html.match(/<title>pi review<\/title>/g)?.length).toBe(1);
  });
});
