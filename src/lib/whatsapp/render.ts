const PLACEHOLDER_RE = /\{\{(\w+)\}\}/g;

export function renderTemplate(
  bodyTemplate: string,
  variables: Record<string, string>,
): string {
  return bodyTemplate.replace(PLACEHOLDER_RE, (match, key: string) => {
    return variables[key] ?? match;
  });
}

export function extractPlaceholders(bodyTemplate: string): string[] {
  const keys: string[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(PLACEHOLDER_RE);
  while ((m = re.exec(bodyTemplate)) !== null) {
    if (!keys.includes(m[1])) keys.push(m[1]);
  }
  return keys;
}
