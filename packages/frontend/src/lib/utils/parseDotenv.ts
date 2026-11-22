import type { EnvironmentVariables } from "@hallmaster/backend/schemas";

const LINE = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/;
const QUOTES = ['"', "'", "`"];

function unquote(raw: string) {
  const quote = raw[0];
  const end = raw.lastIndexOf(quote);

  if (QUOTES.includes(quote) && end > 0) {
    const value = raw.slice(1, end);

    return quote === '"' ? value.replaceAll("\\n", "\n") : value;
  }

  return raw.replace(/\s+#.*$/, "");
}

export default function parseDotenv(text: string): EnvironmentVariables {
  const variables = new Map<string, string>();

  for (const line of text.split(/\r?\n/)) {
    const match = LINE.exec(line);
    if (match === null) continue;

    const [, key, raw] = match;
    variables.set(key, unquote(raw));
  }

  return [...variables].map(([key, value]) => ({ key, value }));
}
