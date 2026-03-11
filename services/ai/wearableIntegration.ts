import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

interface WearableData {
  timestamp: number;
  heartRate?: number;
  hrv?: number;
  steps?: number;
  sleepQuality?: number;
  stressLevel?: number;
  bloodOxygen?: number;
}

interface StressIndicators {
  level: 'low' | 'moderate' | 'high' | 'critical';
  score: number;
  factors: string[];
  recommendation: string;
}

interface CognitiveStateFromWearable {
  stressLevel: StressIndicators;
  physicalRecovery: number;
  readinessScore: number;
  suggestedComplexity: 1 | 2 | 3;
  breakRecommended: boolean;
}

const WEARABLE_STORAGE_KEY = 'mindease_wearable_data';
const LAST_SYNC_KEY = 'mindease_last_wearable_sync';

export class WearableIntegrationService {
  private isAvailable = false;
  private lastData: WearableData | null = null;
  private dataHistory: WearableData[] = [];
  private readonly maxHistorySize = 168;

  async initialize(): Promise<boolean> {
    if (Platform.OS === 'web') {
      this.isAvailable = false;
      return false;
    }

    try {
      await this.loadStoredData();
      this.isAvailable = true;
      return true;
    } catch {
      this.isAvailable = false;
      return false;
    }
  }

  private async loadStoredData(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(WEARABLE_STORAGE_KEY);
      if (stored) {
        this.dataHistory = JSON.parse(stored);
      }
    } catch (error) {
      console.warn('Failed to load wearable data:', error);
    }
  }

  private async saveData(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        WEARABLE_STORAGE_KEY,
        JSON.stringify(this.dataHistory.slice(-this.maxHistorySize))
      );
      await AsyncStorage.setItem(LAST_SYNC_KEY, Date.now().toString());
    } catch (error) {
      console.warn('Failed to save wearable data:', error);
    }
  }

  async syncWithWearable(): Promise<WearableData | null> {
    if (!this.isAvailable) return null;

    try {
      const data = await this.fetchWearableData();
      if (data) {
        this.lastData = data;
        this.dataHistory.push(data);
        await this.saveData();
      }
      return data;
    } catch (error) {
      console.warn('Wearable sync failed:', error);
      return null;
    }
  }

  private async fetchWearableData(): Promise<WearableData | null> {
    if (Platform.OS === 'web') return null;

    try {
      return {
        timestamp: Date.now(),
        heartRate: 72 + Math.random() * 20,
        hrv: 45 + Math.random() * 25,
        steps: Math.floor(Math.random() * 5000),
        sleepQuality: 70 + Math.random() * 30,
        stressLevel: Math.random() * 100,
        bloodOxygen: 95 + Math.random() * 5,
      };
    } catch {
      return null;
    }
  }

  simulateWearableData(overrides?: Partial<WearableData>): WearableData {
    const baseData: WearableData = {
      timestamp: Date.now(),
      heartRate: 65 + Math.random() * 30,
      hrv: 40 + Math.random() * 30,
      steps: Math.floor(Math.random() * 10000),
      sleepQuality: 60 + Math.random() * 40,
      stressLevel: Math.random() * 100,
      bloodOxygen: 95 + Math.random() * 4,
    };

    const data = { ...baseData, ...overrides };
    this.lastData = data;
    this.dataHistory.push(data);
    
    if (this.dataHistory.length > this.maxHistorySize) {
      this.dataHistory = this.dataHistory.slice(-this.maxHistorySize);
    }

    void this.saveData();
    return data;
  }

  analyzeCognitiveState(): CognitiveStateFromWearable {
    const recentData = this.dataHistory.slice(-24);
    
    if (recentData.length === 0 || !this.lastData) {
      return this.getDefaultState();
    }

    const avgHeartRate = this.calculateAverage(recentData.map(d => d.heartRate));
    const avgHRV = this.calculateAverage(recentData.map(d => d.hrv));
    const avgStress = this.calculateAverage(recentData.map(d => d.stressLevel));
    const avgSleep = this.calculateAverage(recentData.map(d => d.sleepQuality));

    const stressIndicators = this.calculateStressIndicators(
      avgHeartRate,
      avgHRV,
      avgStress,
      this.lastData
    );

    const physicalRecovery = this.calculateRecoveryScore(avgSleep, avgHRV);
    const readinessScore = this.calculateReadinessScore(
      physicalRecovery,
      stressIndicators.score
    );

    return {
      stressLevel: stressIndicators,
      physicalRecovery,
      readinessScore,
      suggestedComplexity: this.suggestComplexity(readinessScore, stressIndicators.level),
      breakRecommended: stressIndicators.level === 'high' || stressIndicators.level === 'critical',
    };
  }

  private calculateStressIndicators(
    avgHeartRate: number,
    avgHRV: number,
    avgStress: number,
    current: WearableData
  ): StressIndicators {
    const factors: string[] = [];
    let score = 0;

    if (avgHeartRate > 85) {
      factors.push('Frequência cardíaca elevada');
      score += 25;
    }

    if (avgHRV < 35) {
      factors.push('Variabilidade cardíaca baixa');
      score += 30;
    }

    if (avgStress > 60) {
      factors.push('Nível de stress elevado');
      score += 35;
    }

    if (current.bloodOxygen && current.bloodOxygen < 95) {
      factors.push('Oxigenação reduzida');
      score += 10;
    }

    let level: StressIndicators['level'];
    let recommendation: string;

    if (score >= 70) {
      level = 'critical';
      recommendation = 'Pause imediatamente. Respire profundamente por 2 minutos.';
    } else if (score >= 50) {
      level = 'high';
      recommendation = 'Sugiro uma pausa de 10 minutos e exercícios de relaxamento.';
    } else if (score >= 30) {
      level = 'moderate';
      recommendation = 'Monitore seus sinais. Considere uma pausa breve em breve.';
    } else {
      level = 'low';
      recommendation = 'Seus indicadores físicos estão bons. Continue com foco.';
    }

    return { level, score: Math.min(100, score), factors, recommendation };
  }

  private calculateRecoveryScore(sleepQuality: number, hrv: number): number {
    const sleepScore = sleepQuality * 0.6;
    const hrvScore = Math.min(100, (hrv / 60) * 100) * 0.4;
    return Math.round(sleepScore + hrvScore);
  }

  private calculateReadinessScore(recovery: number, stressScore: number): number {
    const stressPenalty = stressScore * 0.5;
    return Math.max(0, Math.round(recovery - stressPenalty));
  }

  private suggestComplexity(
    readiness: number,
    stressLevel: StressIndicators['level']
  ): 1 | 2 | 3 {
    if (stressLevel === 'critical' || readiness < 30) return 1;
    if (stressLevel === 'high' || readiness < 60) return 1;
    if (stressLevel === 'moderate' || readiness < 80) return 2;
    return 3;
  }

  private getDefaultState(): CognitiveStateFromWearable {
    return {
      stressLevel: {
        level: 'low',
        score: 20,
        factors: ['Dados insuficientes'],
        recommendation: 'Conecte um wearable para análises mais precisas.',
      },
      physicalRecovery: 75,
      readinessScore: 70,
      suggestedComplexity: 2,
      breakRecommended: false,
    };
  }

  private calculateAverage(values: (number | undefined)[]): number {
    const validValues = values.filter((v): v is number => v !== undefined);
    if (validValues.length === 0) return 0;
    return validValues.reduce((a, b) => a + b, 0) / validValues.length;
  }

  getTrends(): {
    heartRateTrend: 'improving' | 'stable' | 'worsening';
    stressTrend: 'improving' | 'stable' | 'worsening';
    hrvTrend: 'improving' | 'stable' | 'worsening';
  } {
    if (this.dataHistory.length < 12) {
      return { heartRateTrend: 'stable', stressTrend: 'stable', hrvTrend: 'stable' };
    }

    const recent = this.dataHistory.slice(-6);
    const previous = this.dataHistory.slice(-12, -6);

    return {
      heartRateTrend: this.calculateTrend(
        recent.map(d => d.heartRate),
        previous.map(d => d.heartRate),
        'lower'
      ),
      stressTrend: this.calculateTrend(
        recent.map(d => d.stressLevel),
        previous.map(d => d.stressLevel),
        'lower'
      ),
      hrvTrend: this.calculateTrend(
        recent.map(d => d.hrv),
        previous.map(d => d.hrv),
        'higher'
      ),
    };
  }

  private calculateTrend(
    recent: (number | undefined)[],
    previous: (number | undefined)[],
    better: 'higher' | 'lower'
  ): 'improving' | 'stable' | 'worsening' {
    const recentAvg = this.calculateAverage(recent);
    const previousAvg = this.calculateAverage(previous);
    const diff = recentAvg - previousAvg;

    if (Math.abs(diff) < 5) return 'stable';
    
    const improving = better === 'higher' ? diff > 0 : diff < 0;
    return improving ? 'improving' : 'worsening';
  }

  getCorrelationWithCognitiveLoad(): {
    correlation: number;
    insights: string[];
  } {
    const insights: string[] = [];
    
    if (this.dataHistory.length < 24) {
      return { correlation: 0, insights: ['Coletando mais dados...'] };
    }

    const highStressPeriods = this.dataHistory.filter(d => (d.stressLevel || 0) > 70);
    const lowHRVPeriods = this.dataHistory.filter(d => (d.hrv || 60) < 35);

    if (highStressPeriods.length > this.dataHistory.length * 0.3) {
      insights.push('Períodos prolongados de stress detectados. Considere técnicas de relaxamento.');
    }

    if (lowHRVPeriods.length > this.dataHistory.length * 0.2) {
      insights.push('Variabilidade cardíaca baixa frequente. Priorize recuperação.');
    }

    const correlation = Math.min(1, highStressPeriods.length / this.dataHistory.length + 0.3);

    return { correlation, insights };
  }

  isWearableConnected(): boolean {
    return this.isAvailable;
  }

  getLastSyncTime(): number | null {
    return this.lastData?.timestamp || null;
  }

  clearData(): void {
    this.dataHistory = [];
    this.lastData = null;
    void AsyncStorage.removeItem(WEARABLE_STORAGE_KEY);
    void AsyncStorage.removeItem(LAST_SYNC_KEY);
  }
}

export const wearableService = new WearableIntegrationService();
