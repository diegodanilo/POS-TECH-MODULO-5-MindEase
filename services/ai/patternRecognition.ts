import { BehavioralPattern, DailyCognitiveReport, InteractionEvent } from '@/types/ai';
import { CognitiveState, Task } from '@/types/mindease';

interface PatternSignature {
  type: BehavioralPattern['patternType'];
  indicators: {
    taskSwitchRate: { min: number; max: number };
    avgSessionDuration: { min: number; max: number };
    completionRate: { min: number; max: number };
    consistencyScore: { min: number; max: number };
  };
  weight: number;
}

const PATTERN_SIGNATURES: PatternSignature[] = [
  {
    type: 'high_performer',
    indicators: {
      taskSwitchRate: { min: 0, max: 2 },
      avgSessionDuration: { min: 20, max: 60 },
      completionRate: { min: 0.8, max: 1 },
      consistencyScore: { min: 0.7, max: 1 },
    },
    weight: 1.2,
  },
  {
    type: 'frequent_switcher',
    indicators: {
      taskSwitchRate: { min: 4, max: 20 },
      avgSessionDuration: { min: 5, max: 15 },
      completionRate: { min: 0.3, max: 0.7 },
      consistencyScore: { min: 0, max: 0.4 },
    },
    weight: 1.0,
  },
  {
    type: 'deep_diver',
    indicators: {
      taskSwitchRate: { min: 0, max: 1 },
      avgSessionDuration: { min: 45, max: 180 },
      completionRate: { min: 0.6, max: 0.9 },
      consistencyScore: { min: 0.5, max: 0.8 },
    },
    weight: 1.1,
  },
  {
    type: 'bursty_worker',
    indicators: {
      taskSwitchRate: { min: 2, max: 5 },
      avgSessionDuration: { min: 10, max: 30 },
      completionRate: { min: 0.5, max: 0.8 },
      consistencyScore: { min: 0.3, max: 0.6 },
    },
    weight: 1.0,
  },
  {
    type: 'consistency_king',
    indicators: {
      taskSwitchRate: { min: 1, max: 3 },
      avgSessionDuration: { min: 15, max: 40 },
      completionRate: { min: 0.7, max: 1 },
      consistencyScore: { min: 0.8, max: 1 },
    },
    weight: 1.3,
  },
];

interface HistoricalMetrics {
  taskSwitchRate: number;
  avgSessionDuration: number;
  completionRate: number;
  consistencyScore: number;
  dailyFocusScores: number[];
  peakPerformanceHour: number;
}

export class PatternRecognitionEngine {
  private eventHistory: InteractionEvent[] = [];
  private detectedPatterns: BehavioralPattern[] = [];
  private readonly confidenceThreshold = 0.65;
  private readonly minEventsForAnalysis = 20;

  recordEvent(event: InteractionEvent): void {
    this.eventHistory.push(event);
    
    if (this.eventHistory.length > 500) {
      this.eventHistory = this.eventHistory.slice(-500);
    }
  }

  analyzePatterns(
    state: CognitiveState,
    tasks: Task[],
    daysOfHistory: number = 7
  ): BehavioralPattern[] {
    if (this.eventHistory.length < this.minEventsForAnalysis) {
      return [];
    }

    const metrics = this.calculateHistoricalMetrics(daysOfHistory);
    const newPatterns: BehavioralPattern[] = [];

    for (const signature of PATTERN_SIGNATURES) {
      const confidence = this.calculatePatternConfidence(metrics, signature);
      
      if (confidence >= this.confidenceThreshold) {
        const evidence = this.gatherEvidence(metrics, signature);
        
        const pattern: BehavioralPattern = {
          id: `ptrn_${Date.now()}_${signature.type}`,
          patternType: signature.type,
          confidence: Math.round(confidence * 100) / 100,
          detectedAt: Date.now(),
          supportingEvidence: evidence,
        };

        newPatterns.push(pattern);
      }
    }

    this.detectedPatterns = newPatterns;
    return newPatterns;
  }

  detectTrend(
    dailyScores: number[],
    minDataPoints: number = 3
  ): 'improving' | 'stable' | 'declining' {
    if (dailyScores.length < minDataPoints) return 'stable';

    const recent = dailyScores.slice(-7);
    if (recent.length < minDataPoints) return 'stable';

    const firstHalf = recent.slice(0, Math.floor(recent.length / 2));
    const secondHalf = recent.slice(Math.floor(recent.length / 2));

    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    const changePercent = ((secondAvg - firstAvg) / firstAvg) * 100;

    if (changePercent > 10) return 'improving';
    if (changePercent < -10) return 'declining';
    return 'stable';
  }

  predictOptimalSessionLength(pattern: BehavioralPattern | null): number {
    if (!pattern) return 25;

    const sessionLengths: Record<BehavioralPattern['patternType'], number> = {
      high_performer: 45,
      frequent_switcher: 15,
      deep_diver: 60,
      bursty_worker: 20,
      consistency_king: 30,
    };

    return sessionLengths[pattern.patternType] || 25;
  }

  predictBestFocusTime(): { hour: number; confidence: number } {
    const eventsByHour = new Array(24).fill(0);
    const scoresByHour = new Array(24).fill(0).map(() => [] as number[]);

    for (const event of this.eventHistory) {
      if (event.type === 'focus_start') {
        const hour = new Date(event.timestamp).getHours();
        eventsByHour[hour]++;
        
        if (event.metadata?.focusScore) {
          scoresByHour[hour].push(event.metadata.focusScore as number);
        }
      }
    }

    let bestHour = 9;
    let bestScore = 0;

    for (let hour = 0; hour < 24; hour++) {
      const frequency = eventsByHour[hour];
      const avgScore = scoresByHour[hour].length > 0
        ? scoresByHour[hour].reduce((a, b) => a + b, 0) / scoresByHour[hour].length
        : 50;

      const compositeScore = frequency * 0.3 + avgScore * 0.7;
      
      if (compositeScore > bestScore) {
        bestScore = compositeScore;
        bestHour = hour;
      }
    }

    const confidence = Math.min(1, eventsByHour[bestHour] / 10);

    return { hour: bestHour, confidence };
  }

  generateInsights(
    patterns: BehavioralPattern[],
    metrics: HistoricalMetrics
  ): string[] {
    const insights: string[] = [];

    if (patterns.some(p => p.patternType === 'frequent_switcher')) {
      insights.push(
        'Você tende a alternar entre tarefas frequentemente. Experimente o modo Foco Único por 15 minutos.'
      );
    }

    if (patterns.some(p => p.patternType === 'deep_diver')) {
      insights.push(
        'Você tem capacidade de foco prolongado. Cuidado com a fadiga - lembre-se de pausas programadas.'
      );
    }

    if (metrics.completionRate < 0.5) {
      insights.push(
        'Sua taxa de conclusão está abaixo de 50%. Tente dividir tarefas grandes em subtarefas menores.'
      );
    }

    if (metrics.consistencyScore > 0.8) {
      insights.push(
        'Excelente consistência! Sua rotina de foco está muito bem estabelecida.'
      );
    }

    if (metrics.peakPerformanceHour >= 0) {
      const hourStr = `${metrics.peakPerformanceHour}:00`;
      insights.push(
        `Seu horário de melhor performance é próximo às ${hourStr}. Reserve tarefas complexas para esse período.`
      );
    }

    return insights;
  }

  generateDailyReport(
    date: string,
    state: CognitiveState,
    tasks: Task[]
  ): DailyCognitiveReport {
    const patterns = this.detectedPatterns;
    const metrics = this.calculateHistoricalMetrics(1);

    const completedTasks = tasks.filter(t => t.status === 'completed');
    const totalFocusTime = completedTasks.reduce(
      (sum, t) => sum + (t.estimatedMinutes || 0), 
      0
    );

    const dailyScores = this.extractDailyScores(date);
    const avgFocusScore = dailyScores.length > 0
      ? dailyScores.reduce((a, b) => a + b, 0) / dailyScores.length
      : state.focusScore;

    const overloadEvents = this.eventHistory.filter(e => {
      const eventDate = new Date(e.timestamp).toISOString().split('T')[0];
      return eventDate === date && e.type === 'break_taken';
    }).length;

    const breaksTaken = this.eventHistory.filter(e => {
      const eventDate = new Date(e.timestamp).toISOString().split('T')[0];
      return eventDate === date && e.type === 'break_taken';
    }).length;

    return {
      date,
      summary: {
        totalFocusTime,
        averageFocusScore: Math.round(avgFocusScore),
        overloadEvents,
        breaksTaken,
        tasksCompleted: completedTasks.length,
      },
      patterns,
      insights: this.generateInsights(patterns, metrics),
      recommendations: this.generateRecommendations(patterns, metrics),
      trend: this.detectTrend(dailyScores),
    };
  }

  private calculateHistoricalMetrics(days: number): HistoricalMetrics {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const recentEvents = this.eventHistory.filter(e => e.timestamp >= cutoff);

    const sessions = this.extractSessions(recentEvents);
    const completedTasks = recentEvents.filter(e => e.type === 'complete').length;
    const totalTasks = recentEvents.filter(e => 
      e.type === 'focus_start'
    ).length;

    const avgDuration = sessions.length > 0
      ? sessions.reduce((sum, s) => sum + s.duration, 0) / sessions.length / 60000
      : 0;

    const switchCount = recentEvents.filter(e => e.type === 'task_switch').length;
    const switchRate = switchCount / Math.max(days, 1);

    const dailyScores = this.extractDailyScoresRange(days);
    const consistencyScore = this.calculateConsistencyScore(dailyScores);

    const peakHour = this.detectPeakPerformanceHour(recentEvents);

    return {
      taskSwitchRate: switchRate,
      avgSessionDuration: avgDuration,
      completionRate: totalTasks > 0 ? completedTasks / totalTasks : 0,
      consistencyScore,
      dailyFocusScores: dailyScores,
      peakPerformanceHour: peakHour,
    };
  }

  private extractSessions(events: InteractionEvent[]): Array<{ start: number; end: number; duration: number }> {
    const sessions: Array<{ start: number; end: number; duration: number }> = [];
    let currentSession: { start: number; events: number } | null = null;

    for (const event of events) {
      if (event.type === 'focus_start') {
        currentSession = { start: event.timestamp, events: 1 };
      } else if (event.type === 'focus_end' && currentSession) {
        const duration = event.timestamp - currentSession.start;
        sessions.push({
          start: currentSession.start,
          end: event.timestamp,
          duration,
        });
        currentSession = null;
      }
    }

    return sessions;
  }

  private calculatePatternConfidence(
    metrics: HistoricalMetrics,
    signature: PatternSignature
  ): number {
    let totalScore = 0;
    let totalWeight = 0;

    const indicators = [
      { value: metrics.taskSwitchRate, ...signature.indicators.taskSwitchRate, weight: 1 },
      { value: metrics.avgSessionDuration, ...signature.indicators.avgSessionDuration, weight: 1 },
      { value: metrics.completionRate, ...signature.indicators.completionRate, weight: 1.2 },
      { value: metrics.consistencyScore, ...signature.indicators.consistencyScore, weight: 0.8 },
    ];

    for (const indicator of indicators) {
      const { value, min, max, weight } = indicator;
      
      if (value >= min && value <= max) {
        const mid = (min + max) / 2;
        const distance = Math.abs(value - mid);
        const range = (max - min) / 2;
        const matchScore = 1 - (distance / range) * 0.5;
        
        totalScore += matchScore * weight;
      }
      
      totalWeight += weight;
    }

    return (totalScore / totalWeight) * signature.weight;
  }

  private gatherEvidence(
    metrics: HistoricalMetrics,
    signature: PatternSignature
  ): string[] {
    const evidence: string[] = [];

    if (metrics.taskSwitchRate >= signature.indicators.taskSwitchRate.min &&
        metrics.taskSwitchRate <= signature.indicators.taskSwitchRate.max) {
      evidence.push(`Taxa de alternância: ${metrics.taskSwitchRate.toFixed(1)}/dia`);
    }

    if (metrics.avgSessionDuration >= signature.indicators.avgSessionDuration.min &&
        metrics.avgSessionDuration <= signature.indicators.avgSessionDuration.max) {
      evidence.push(`Duração média: ${metrics.avgSessionDuration.toFixed(0)} min`);
    }

    if (metrics.completionRate >= signature.indicators.completionRate.min &&
        metrics.completionRate <= signature.indicators.completionRate.max) {
      evidence.push(`Taxa de conclusão: ${(metrics.completionRate * 100).toFixed(0)}%`);
    }

    return evidence;
  }

  private calculateConsistencyScore(scores: number[]): number {
    if (scores.length < 2) return 0;

    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length;
    const stdDev = Math.sqrt(variance);

    const cv = stdDev / mean;
    return Math.max(0, 1 - cv);
  }

  private detectPeakPerformanceHour(events: InteractionEvent[]): number {
    const hourlyScores = new Array(24).fill(0).map(() => ({ count: 0, total: 0 }));

    for (const event of events) {
      if (event.type === 'focus_end' && event.metadata?.focusScore) {
        const hour = new Date(event.timestamp).getHours();
        hourlyScores[hour].count++;
        hourlyScores[hour].total += event.metadata.focusScore as number;
      }
    }

    let bestHour = -1;
    let bestScore = 0;

    for (let hour = 0; hour < 24; hour++) {
      if (hourlyScores[hour].count >= 2) {
        const avg = hourlyScores[hour].total / hourlyScores[hour].count;
        if (avg > bestScore) {
          bestScore = avg;
          bestHour = hour;
        }
      }
    }

    return bestHour;
  }

  private extractDailyScores(date: string): number[] {
    return this.eventHistory
      .filter(e => {
        const eventDate = new Date(e.timestamp).toISOString().split('T')[0];
        return eventDate === date && e.metadata?.focusScore;
      })
      .map(e => e.metadata?.focusScore as number);
  }

  private extractDailyScoresRange(days: number): number[] {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    return this.eventHistory
      .filter(e => e.timestamp >= cutoff && e.metadata?.focusScore)
      .map(e => e.metadata?.focusScore as number);
  }

  private generateRecommendations(
    patterns: BehavioralPattern[],
    metrics: HistoricalMetrics
  ): Array<{ id: string; type: 'break' | 'complexity_adjust' | 'task_reorder' | 'focus_technique' | 'environment'; title: string; description: string; priority: number; expiresAt: number }> {
    const recommendations: Array<{ id: string; type: 'break' | 'complexity_adjust' | 'task_reorder' | 'focus_technique' | 'environment'; title: string; description: string; priority: number; expiresAt: number }> = [];
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000;

    if (patterns.some(p => p.patternType === 'frequent_switcher')) {
      recommendations.push({
        id: `rec_${Date.now()}_pomodoro`,
        type: 'focus_technique',
        title: 'Técnica Pomodoro Modificada',
        description: 'Experimente ciclos de 15 minutos de foco com 5 minutos de pausa. Você responde melhor a sessões curtas.',
        priority: 0.9,
        expiresAt,
      });
    }

    if (patterns.some(p => p.patternType === 'deep_diver')) {
      recommendations.push({
        id: `rec_${Date.now()}_break`,
        type: 'break',
        title: 'Pausa Estratégica Obrigatória',
        description: 'Seus padrões indicam sessões longas. Programe pausas a cada 45 minutos para manter a sustentabilidade.',
        priority: 0.85,
        expiresAt,
      });
    }

    if (metrics.completionRate < 0.5) {
      recommendations.push({
        id: `rec_${Date.now()}_complexity`,
        type: 'complexity_adjust',
        title: 'Reduza a Complexidade da UI',
        description: 'Sua taxa de conclusão sugere sobrecarga. Ative o modo de complexidade reduzida por 24h.',
        priority: 0.8,
        expiresAt,
      });
    }

    if (metrics.peakPerformanceHour >= 0) {
      recommendations.push({
        id: `rec_${Date.now()}_schedule`,
        type: 'task_reorder',
        title: 'Otimize seu Horário',
        description: `Suas melhores sessões ocorrem às ${metrics.peakPerformanceHour}:00. Agende tarefas difíceis para este horário.`,
        priority: 0.75,
        expiresAt,
      });
    }

    return recommendations.sort((a, b) => b.priority - a.priority);
  }

  clearData(): void {
    this.eventHistory = [];
    this.detectedPatterns = [];
  }
}

export const patternRecognition = new PatternRecognitionEngine();
