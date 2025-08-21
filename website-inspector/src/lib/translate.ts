export type TranslateFn = (text: string, locale: string, context?: Record<string, unknown>) => Promise<string>;

// Mock adapter - replace with real LLM later
export const mockTranslate: TranslateFn = async (text, locale) => {
  await new Promise((r) => setTimeout(r, 10));
  return `${text} [${locale}]`;
};

export async function translateAll(
  items: { key: string; source: string }[],
  locale: string,
  translate: TranslateFn = mockTranslate,
) {
  const results: Record<string, string> = {};
  for (const item of items) {
    results[item.key] = await translate(item.source, locale);
  }
  return results;
}
