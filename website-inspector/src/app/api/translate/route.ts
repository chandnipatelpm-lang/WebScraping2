import { NextRequest, NextResponse } from "next/server";
import { mockTranslate } from "@/lib/translate";

export async function POST(req: NextRequest) {
  const { texts, locale } = (await req.json()) as { texts: string[]; locale: string };
  const translations: string[] = [];
  for (const t of texts) {
    translations.push(await mockTranslate(t, locale));
  }
  return NextResponse.json({ translations });
}
