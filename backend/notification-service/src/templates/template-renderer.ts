/** Pure — no templating library, per the "minimize external packages" convention already
 * established for the frontends. Replaces every `{{variableName}}` occurrence with the
 * matching key from `variables`; a placeholder with no matching variable is left as an empty
 * string rather than crashing or leaking the raw `{{...}}` syntax into a sent email. */
export function renderTemplate(template: string, variables: Record<string, unknown>): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) => {
    const value = variables[key];
    return value === undefined || value === null ? '' : String(value);
  });
}
