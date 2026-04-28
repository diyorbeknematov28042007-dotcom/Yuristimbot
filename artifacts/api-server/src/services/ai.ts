import { GoogleGenerativeAI } from '@google/generative-ai';
import type { Lang } from '../bot/languages.js';

const apiKeys = [
  process.env.GEMINI_API_KEY,
  process.env.GEMINI_API_KEY_1,
  process.env.GEMINI_API_KEY_2,
  process.env.GEMINI_API_KEY_3,
  process.env.GEMINI_API_KEY_4,
  process.env.GEMINI_API_KEY_5,
].filter(Boolean) as string[];

let currentKeyIndex = 0;

function getNextKey(): string {
  const key = apiKeys[currentKeyIndex % apiKeys.length];
  currentKeyIndex++;
  return key;
}

const systemPrompts: Record<Lang, string> = {
  uz: "Siz O'zbekiston qonunchiligiga ixtisoslashgan professional yurist assistentsiz. Foydalanuvchilarga O'zbek tilida yuridik maslahat bering. Aniq va tushunarli javob bering.",
  ru: "Вы профессиональный юридический ассистент, специализирующийся на законодательстве Узбекистана. Давайте чёткие и понятные юридические консультации на русском языке.",
  en: "You are a professional legal assistant specializing in Uzbekistan law. Provide clear and understandable legal advice in English.",
};

export async function askGemini(question: string, lang: Lang): Promise<string> {
  if (apiKeys.length === 0) throw new Error('API key topilmadi');

  for (let attempt = 0; attempt < apiKeys.length; attempt++) {
    const key = getNextKey();
    try {
      const genAI = new GoogleGenerativeAI(key);
      const model = genAI.getGenerativeModel({
        model: 'gemini-1.5-flash-latest',
        generationConfig: { maxOutputTokens: 8192 },
        systemInstruction: systemPrompts[lang],
      });
      const result = await model.generateContent(question);
      return result.response.text();
    } catch (error: any) {
      const isLimitError =
        error?.status === 429 ||
        error?.message?.includes('quota') ||
        error?.message?.includes('RESOURCE_EXHAUSTED');

      if (isLimitError && attempt < apiKeys.length - 1) {
        console.warn(`API key ${attempt + 1} limiti tugadi, keyingisiga o'tilmoqda...`);
        continue;
      }
      console.error('Gemini error:', error);
      throw error;
    }
  }
  throw new Error('Barcha API keylar limiti tugadi');
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
