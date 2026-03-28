// Template engine for wiki templates.
// Syntax: {{templateName|param1=value1|param2=value2}}
// Template files use {{{paramName}}} or {{{paramName|default}}} for parameters.
// Positional params: {{templateName|foo|bar}} → {{{1}}} = foo, {{{2}}} = bar

const templateCache = new Map<string, string>();

/** Load all templates from the templates/ directory. */
export async function loadTemplates(dir = "templates") {
  // Try local filesystem first
  try {
    for await (const entry of Deno.readDir(dir)) {
      if (entry.isFile && entry.name.endsWith(".html")) {
        const name = entry.name.replace(".html", "");
        const content = await Deno.readTextFile(`${dir}/${entry.name}`);
        templateCache.set(name, content);
      }
    }
    if (templateCache.size > 0) return;
  } catch {
    // templates dir may not exist locally (e.g. on Deno Deploy)
  }

  // Fall back to loading from GitHub
  const token = Deno.env.get("GITHUB_TOKEN") || Deno.env.get("GH_TOKEN");
  const owner = Deno.env.get("GITHUB_OWNER");
  const repo = Deno.env.get("GITHUB_REPO");
  if (!token || !owner || !repo) return;

  try {
    const headers = {
      "Authorization": `Bearer ${token}`,
      "Accept": "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    };
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/templates`,
      { headers },
    );
    if (!res.ok) return;
    const files = await res.json();
    for (const file of files) {
      if (file.type !== "file" || !file.name.endsWith(".html")) continue;
      const fileRes = await fetch(file.url, { headers });
      if (!fileRes.ok) continue;
      const fileData = await fileRes.json();
      const binary = atob(fileData.content.replace(/\n/g, ""));
      const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
      const content = new TextDecoder().decode(bytes);
      templateCache.set(file.name.replace(".html", ""), content);
    }
  } catch {
    // GitHub API failed — templates won't expand
  }
}

/** Expand all {{template|...}} calls in the given text. */
export function expandTemplates(text: string): string {
  // Match {{name}} or {{name|param1=val1|param2=val2}} or {{name|val1|val2}}
  // Avoid matching {{{ (triple braces used inside templates)
  return text.replace(/\{\{([^{][^}]*?)\}\}/g, (_match, inner) => {
    const parts = inner.split("|");
    const templateName = parts[0].trim();

    const templateContent = templateCache.get(templateName);
    if (!templateContent) {
      // Unknown template — leave as-is
      return `<span class="template-error">{{${inner}}}</span>`;
    }

    // Parse parameters
    const params: Record<string, string> = {};
    let positional = 0;
    for (let i = 1; i < parts.length; i++) {
      const part = parts[i];
      const eqIdx = part.indexOf("=");
      if (eqIdx > 0) {
        params[part.slice(0, eqIdx).trim()] = part.slice(eqIdx + 1).trim();
      } else {
        positional++;
        params[String(positional)] = part.trim();
      }
    }

    // Expand {{{paramName}}} and {{{paramName|default}}} in template
    let result = templateContent.replace(/\{\{\{([^}]+?)\}\}\}/g, (_m, paramExpr) => {
      const [paramName, ...defaultParts] = paramExpr.split("|");
      const defaultVal = defaultParts.join("|");
      return params[paramName.trim()] ?? defaultVal ?? "";
    });

    // Remove empty table rows (for infobox-like templates with optional fields)
    result = result.replace(/<tr>\s*<th>[^<]*<\/th>\s*<td>\s*<\/td>\s*<\/tr>/g, "");
    result = result.replace(/<tr>\s*<td[^>]*>\s*<\/td>\s*<\/tr>/g, "");

    return result.trim();
  });
}
