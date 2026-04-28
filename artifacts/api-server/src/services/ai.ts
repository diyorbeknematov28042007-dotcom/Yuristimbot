import { GoogleGenerativeAI } from '@google/generative-ai';
import type { Lang } from '../bot/languages.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const systemPrompts: Record<Lang, string> = {
  uz: "Siz O'zbekiston qonunchiligiga ixtisoslashgan professional yurist assistentsiz. Foydalanuvchilarga O'zbek tilida yuridik maslahat bering. Aniq va tushunarli javob bering.",
  ru: "Вы профессиональный юридический ассистент, специализирующийся на законодательстве Узбекистана. Давайте чёткие и понятные юридические консультации на русском языке.",
  en: "You are a professional legal assistant specializing in Uzbekistan law. Provide clear and understandable legal advice in English.",
};

export async function askGemini(question: string, lang: Lang): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: { maxOutputTokens: 8192 },
      systemInstruction: systemPrompts[lang],
    });
    const result = await model.generateContent(question);
    return result.response.text();
  } catch (error) {
    console.error('Gemini error:', error);
    throw error;
  }
}

export function splitLongMessage(text: string, maxLen = 4000): string[] {
  if (text.length <= maxLen) return [text];
  const chunks: string[] = [];
  let i = 0;
  while (i < text.length) {
    chunks.push(text.slice(i, i + maxLen));
    i += maxLen;
  }
  return chunks;
}
