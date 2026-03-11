import Sentiment from 'sentiment';

interface SentimentResult {
  score: number;
  comparative: number;
  tokens: string[];
  words: string[];
  positive: string[];
  negative: string[];
}

interface TaskSentimentAnalysis {
  overallSentiment: 'veryPositive' | 'positive' | 'neutral' | 'negative' | 'veryNegative';
  score: number;
  urgencyDetected: boolean;
  complexityIndicators: {
    hasComplexWords: boolean;
    wordCount: number;
    avgWordLength: number;
  };
  emotionalTone: {
    anxiety: number;
    confidence: number;
    frustration: number;
  };
  suggestedPriority: 'low' | 'medium' | 'high';
  suggestedCognitiveLoad: 'low' | 'medium' | 'high';
}

interface SentimentTrend {
  trendDirection: 'improving' | 'declining' | 'stable';
  averageScore: number;
  volatility: number;
  dominantEmotion: string;
}

const cognitiveKeywords = {
  highComplexity: [
    'análise', 'analisar', 'estratégia', 'estratégico', 'complexo', 'difícil',
    'desafiador', 'crítico', 'importante', 'urgente', 'prazo', 'deadline',
    'apresentação', 'relatório', 'pesquisa', 'estudo', 'revisão'
  ],
  lowComplexity: [
    'simples', 'fácil', 'rápido', 'rotina', 'email', 'ligar', 'organizar',
    'limpar', 'revisar', 'confirmar', 'marcar', 'agendar'
  ],
  urgency: [
    'urgente', 'imediato', 'hoje', 'agora', 'critical', 'prazo', 'deadline',
    'atrasado', 'atrasada', 'emergência', 'preciso', 'necessário'
  ],
  anxiety: [
    'preocupado', 'ansioso', 'estressado', 'nervoso', 'medo', 'receio',
    'difícil', 'complicado', 'problema', 'erro', 'errado'
  ],
  confidence: [
    'confiante', 'certeza', 'sei', 'capaz', 'consigo', 'fácil', 'simples',
    'organizado', 'preparado', 'pronto'
  ],
  frustration: [
    'frustrado', 'irritado', 'chateado', 'cansado', 'de novo', 'sempre',
    'nunca', 'demora', 'lento', 'problema'
  ],
};

export class SentimentAnalysisService {
  private analyzer: Sentiment;
  private analysisHistory: { text: string; result: TaskSentimentAnalysis; timestamp: number }[] = [];

  constructor() {
    this.analyzer = new Sentiment();
  }

  analyzeTask(text: string, description?: string): TaskSentimentAnalysis {
    const fullText = description ? `${text} ${description}` : text;
    const sentimentResult = this.analyzer.analyze(fullText) as SentimentResult;
    
    const lowercaseText = fullText.toLowerCase();
    const words = lowercaseText.split(/\s+/).filter(w => w.length > 0);

    const complexityIndicators = this.analyzeComplexity(words, fullText);
    const emotionalTone = this.analyzeEmotionalTone(lowercaseText, sentimentResult);
    const urgencyDetected = this.detectUrgency(lowercaseText);

    const normalizedScore = this.normalizeScore(sentimentResult.score);
    const overallSentiment = this.categorizeSentiment(normalizedScore);

    const analysis: TaskSentimentAnalysis = {
      overallSentiment,
      score: normalizedScore,
      urgencyDetected,
      complexityIndicators,
      emotionalTone,
      suggestedPriority: this.suggestPriority(normalizedScore, urgencyDetected, complexityIndicators),
      suggestedCognitiveLoad: this.suggestCognitiveLoad(complexityIndicators, emotionalTone),
    };

    this.analysisHistory.push({
      text: fullText,
      result: analysis,
      timestamp: Date.now(),
    });

    if (this.analysisHistory.length > 100) {
      this.analysisHistory = this.analysisHistory.slice(-100);
    }

    return analysis;
  }

  private normalizeScore(score: number): number {
    return Math.max(-100, Math.min(100, score * 10));
  }

  private categorizeSentiment(score: number): TaskSentimentAnalysis['overallSentiment'] {
    if (score >= 50) return 'veryPositive';
    if (score >= 20) return 'positive';
    if (score <= -50) return 'veryNegative';
    if (score <= -20) return 'negative';
    return 'neutral';
  }

  private analyzeComplexity(words: string[], text: string): TaskSentimentAnalysis['complexityIndicators'] {
    const avgWordLength = words.reduce((sum, w) => sum + w.length, 0) / (words.length || 1);
    
    const highComplexityMatches = cognitiveKeywords.highComplexity.filter(kw => 
      text.toLowerCase().includes(kw)
    ).length;
    
    const hasComplexWords = highComplexityMatches >= 2 || avgWordLength > 6;

    return {
      hasComplexWords,
      wordCount: words.length,
      avgWordLength: Math.round(avgWordLength * 10) / 10,
    };
  }

  private analyzeEmotionalTone(text: string, sentiment: SentimentResult): TaskSentimentAnalysis['emotionalTone'] {
    const anxietyScore = this.countKeywordMatches(text, cognitiveKeywords.anxiety);
    const confidenceScore = this.countKeywordMatches(text, cognitiveKeywords.confidence);
    const frustrationScore = this.countKeywordMatches(text, cognitiveKeywords.frustration);

    const totalWords = text.split(/\s+/).length || 1;

    return {
      anxiety: Math.min(100, (anxietyScore / totalWords) * 100 * 5),
      confidence: Math.min(100, (confidenceScore / totalWords) * 100 * 5 + (sentiment.score > 0 ? 20 : 0)),
      frustration: Math.min(100, (frustrationScore / totalWords) * 100 * 5 + (sentiment.score < 0 ? 15 : 0)),
    };
  }

  private countKeywordMatches(text: string, keywords: string[]): number {
    return keywords.filter(kw => text.includes(kw)).length;
  }

  private detectUrgency(text: string): boolean {
    return cognitiveKeywords.urgency.some(kw => text.includes(kw));
  }

  private suggestPriority(
    sentimentScore: number,
    urgencyDetected: boolean,
    complexity: TaskSentimentAnalysis['complexityIndicators']
  ): TaskSentimentAnalysis['suggestedPriority'] {
    let priorityScore = 0;

    if (urgencyDetected) priorityScore += 3;
    if (complexity.hasComplexWords) priorityScore += 1;
    if (complexity.wordCount > 10) priorityScore += 1;
    if (sentimentScore < -30) priorityScore += 1;

    if (priorityScore >= 4) return 'high';
    if (priorityScore >= 2) return 'medium';
    return 'low';
  }

  private suggestCognitiveLoad(
    complexity: TaskSentimentAnalysis['complexityIndicators'],
    emotionalTone: TaskSentimentAnalysis['emotionalTone']
  ): TaskSentimentAnalysis['suggestedCognitiveLoad'] {
    let loadScore = 0;

    if (complexity.hasComplexWords) loadScore += 2;
    if (complexity.wordCount > 15) loadScore += 1;
    if (complexity.avgWordLength > 6) loadScore += 1;
    if (emotionalTone.anxiety > 50) loadScore += 1;
    if (emotionalTone.frustration > 50) loadScore += 1;

    if (loadScore >= 4) return 'high';
    if (loadScore >= 2) return 'medium';
    return 'low';
  }

  analyzeTrend(days: number = 7): SentimentTrend {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const recentAnalyses = this.analysisHistory.filter(a => a.timestamp >= cutoff);

    if (recentAnalyses.length === 0) {
      return {
        trendDirection: 'stable',
        averageScore: 0,
        volatility: 0,
        dominantEmotion: 'neutral',
      };
    }

    const scores = recentAnalyses.map(a => a.result.score);
    const averageScore = scores.reduce((a, b) => a + b, 0) / scores.length;

    const firstHalf = scores.slice(0, Math.floor(scores.length / 2));
    const secondHalf = scores.slice(Math.floor(scores.length / 2));
    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / (firstHalf.length || 1);
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / (secondHalf.length || 1);

    const variance = scores.reduce((sum, s) => sum + Math.pow(s - averageScore, 2), 0) / scores.length;
    const volatility = Math.sqrt(variance);

    let trendDirection: SentimentTrend['trendDirection'];
    if (secondAvg > firstAvg + 10) trendDirection = 'improving';
    else if (secondAvg < firstAvg - 10) trendDirection = 'declining';
    else trendDirection = 'stable';

    const allEmotions = recentAnalyses.flatMap(a => [
      { type: 'anxiety', value: a.result.emotionalTone.anxiety },
      { type: 'confidence', value: a.result.emotionalTone.confidence },
      { type: 'frustration', value: a.result.emotionalTone.frustration },
    ]);

    const emotionAverages = {
      anxiety: allEmotions.filter(e => e.type === 'anxiety').reduce((a, b) => a + b.value, 0) / recentAnalyses.length,
      confidence: allEmotions.filter(e => e.type === 'confidence').reduce((a, b) => a + b.value, 0) / recentAnalyses.length,
      frustration: allEmotions.filter(e => e.type === 'frustration').reduce((a, b) => a + b.value, 0) / recentAnalyses.length,
    };

    const dominantEmotion = Object.entries(emotionAverages)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || 'neutral';

    return {
      trendDirection,
      averageScore: Math.round(averageScore),
      volatility: Math.round(volatility * 10) / 10,
      dominantEmotion,
    };
  }

  generateInsights(): string[] {
    const trend = this.analyzeTrend();
    const insights: string[] = [];

    if (trend.trendDirection === 'declining') {
      insights.push('Suas tarefas recentes têm tom mais negativo. Considere dividir tarefas grandes.');
    }

    if (trend.volatility > 30) {
      insights.push('Alta variação emocional nas tarefas. Tente manter consistência no ritmo.');
    }

    if (trend.dominantEmotion === 'anxiety') {
      insights.push('Ansiedade detectada frequentemente. Use a técnica de respiração disponível.');
    }

    if (trend.dominantEmotion === 'frustration') {
      insights.push('Frustração recorrente. Considere reavaliar prioridades.');
    }

    const recentUrgent = this.analysisHistory
      .slice(-20)
      .filter(a => a.result.urgencyDetected).length;
    
    if (recentUrgent > 10) {
      insights.push(`${recentUrgent} tarefas urgentes recentes. Cuidado com burnout.`);
    }

    return insights.length > 0 ? insights : ['Padrões emocionais estáveis nas tarefas.'];
  }

  getSentimentColor(score: number): string {
    if (score >= 50) return '#22c55e';
    if (score >= 20) return '#84cc16';
    if (score >= -20) return '#94a3b8';
    if (score >= -50) return '#f59e0b';
    return '#ef4444';
  }

  clearHistory(): void {
    this.analysisHistory = [];
  }
}

export const sentimentAnalyzer = new SentimentAnalysisService();
