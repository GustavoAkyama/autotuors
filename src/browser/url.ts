/**
 * A site's address as people type it: "meusite.com/login" becomes
 * "https://meusite.com/login", and "localhost:3000" becomes "http://localhost:3000".
 */
export function siteUrl(input: string) {
  const text = input.trim();
  const local = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?(\/|$)/i.test(text);
  const address = /^https?:\/\//i.test(text)
    ? text
    : `${local ? "http" : "https"}://${text}`;
  try {
    const url = new URL(address);
    if (url.hostname.includes(".") || local || url.hostname === "localhost")
      return url.href;
  } catch {}
  throw new Error(
    `“${input}” não parece um endereço. Use algo como https://meusite.com/painel.`,
  );
}
