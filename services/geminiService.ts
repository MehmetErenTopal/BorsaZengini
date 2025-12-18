
import { GoogleGenAI } from "@google/genai";

export class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  }

  async getMarketInsight(symbol: string) {
    try {
      const response = await this.ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Analyze the current market sentiment and potential price movement for ${symbol} using recent real-world data. Provide a short, professional investment summary in Turkish. Mention if there's any recent news impacting it.`,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });

      const text = response.text || "Piyasa analizi şu an alınamıyor.";
      const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      
      return { text, sources };
    } catch (error) {
      console.error("Gemini Insight Error:", error);
      return { text: "Gerçek zamanlı piyasa verilerine ulaşılamadı. Lütfen daha sonra tekrar deneyin.", sources: [] };
    }
  }

  async getDailyProverb() {
    try {
      const response = await this.ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: "Finansal özgürlük ve yatırım hakkında kısa ve ilham verici bir söz söyle.",
      });
      return response.text || "Sabır, en büyük sermayedir.";
    } catch {
      return "Para bir araçtır, amaç değil.";
    }
  }
}
