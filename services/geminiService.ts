
import { GoogleGenAI } from "@google/genai";

export class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    // API Anahtarı process.env.API_KEY üzerinden otomatik alınır.
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  }

  async getMarketInsight(symbol: string) {
    try {
      const response = await this.ai.models.generateContent({
        model: "gemini-flash-lite-latest",
        contents: `${symbol} hissesi/varlığı için mevcut piyasa durumunu, popülerliğini ve genel yatırımcı algısını analiz et. Kısa, profesyonel ve Türkçe bir özet sun. (Not: Ücretsiz sürüm modundasın, genel verileri kullan).`,
        // Ücretsiz anahtarlar için hata riski taşıyan googleSearch kaldırıldı.
      });

      const text = response.text || "Piyasa analizi şu an için hazırlanamadı.";
      
      return { text, sources: [] };
    } catch (error) {
      console.error("Gemini Insight Error:", error);
      return { 
        text: "Şu an için yapay zeka analizi yapılamıyor (API kotası veya bağlantı sorunu). Ancak piyasa hareketlerini grafik üzerinden takip edebilirsiniz.", 
        sources: [] 
      };
    }
  }

  async getDailyProverb() {
    try {
      const response = await this.ai.models.generateContent({
        model: "gemini-flash-lite-latest",
        contents: "Finansal başarı ve sabır hakkında 10 kelimeyi geçmeyen, Türkçe, motivasyonel bir söz söyle.",
      });
      return response.text?.trim() || "Sabır, en büyük sermayedir.";
    } catch {
      return "Para bir araçtır, amaç değil.";
    }
  }
}
