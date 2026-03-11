import AsyncStorage from '@react-native-async-storage/async-storage';
import { addHours, format, getDay, getHours, startOfDay } from 'date-fns';

interface FocusSession {
  startTime: number;
  endTime: number;
  duration: number;
  quality: number;
  interruptions: number;
  dayOfWeek: number;
  hourOfDay: number;
}

interface FocusPredictionResult {
  optimalWindows: Array<{
    start: number;
    end: number;
    confidence: number;
    predictedQuality: number;
  }>;
  currentFocusPotential: number;
  recommendation: string;
  nextOptimalTime: Date | null;
  factors: string[];
}

interface CircadianProfile {
  peakHours: number[];
  troughHours: number[];
  averageFocusDuration: number;
  bestDays: number[];
  worstDays: number[];
  consistencyScore: number;
}

interface EnergyLevel {
  time: number;
  level: number;
  factors: string[];
}

const FOCUS_SESSIONS_KEY = 'mindease_focus_sessions';
const CIRCADIAN_KEY = 'mindease_circadian_profile';

export class FocusPredictionService {
  private sessions: FocusSession[] = [];
  private circadianProfile: CircadianProfile | null = null;
  private energyHistory: EnergyLevel[] = [];

  async initialize(): Promise<void> {
    await this.loadData();
    if (this.sessions.length > 10) {
      this.calculateCircadianProfile();
    }
  }

  private async loadData(): Promise<void> {
    try {
      const [sessionsData, circadianData] = await Promise.all([
        AsyncStorage.getItem(FOCUS_SESSIONS_KEY),
        AsyncStorage.getItem(CIRCADIAN_KEY),
      ]);

      if (sessionsData) {
        this.sessions = JSON.parse(sessionsData);
      }

      if (circadianData) {
        this.circadianProfile = JSON.parse(circadianData);
      }
    } catch (error) {
      console.warn('Failed to load focus prediction data:', error);
    }
  }

  private async saveData(): Promise<void> {
    try {
      await AsyncStorage.setItem(FOCUS_SESSIONS_KEY, JSON.stringify(this.sessions.slice(-200)));
      if (this.circadianProfile) {
        await AsyncStorage.setItem(CIRCADIAN_KEY, JSON.stringify(this.circadianProfile));
      }
    } catch (error) {
      console.warn('Failed to save focus prediction data:', error);
    }
  }

  recordSession(
    startTime: number,
    endTime: number,
    quality: number,
    interruptions: number
  ): void {
    const start = new Date(startTime);
    const session: FocusSession = {
      startTime,
      endTime,
      duration: (endTime - startTime) / 60000,
      quality,
      interruptions,
      dayOfWeek: getDay(start),
      hourOfDay: getHours(start),
    };

    this.sessions.push(session);

    if (this.sessions.length > 200) {
      this.sessions = this.sessions.slice(-200);
    }

    this.calculateCircadianProfile();
    void this.saveData();
  }

  private calculateCircadianProfile(): void {
    if (this.sessions.length < 5) return;

    const hourlyScores = new Map<number, { total: number; count: number }>();
    const dailyScores = new Map<number, { total: number; count: number }>();

    this.sessions.forEach(session => {
      const hourData = hourlyScores.get(session.hourOfDay) || { total: 0, count: 0 };
      hourData.total += session.quality;
      hourData.count++;
      hourlyScores.set(session.hourOfDay, hourData);

      const dayData = dailyScores.get(session.dayOfWeek) || { total: 0, count: 0 };
      dayData.total += session.quality;
      dayData.count++;
      dailyScores.set(session.dayOfWeek, dayData);
    });

    const hourAverages = Array.from(hourlyScores.entries())
      .map(([hour, data]) => ({ hour, avg: data.total / data.count }))
      .sort((a, b) => b.avg - a.avg);

    const peakHours = hourAverages.slice(0, 4).map(h => h.hour);
    const troughHours = hourAverages.slice(-4).map(h => h.hour);

    const dayAverages = Array.from(dailyScores.entries())
      .map(([day, data]) => ({ day, avg: data.total / data.count }))
      .sort((a, b) => b.avg - a.avg);

    const bestDays = dayAverages.slice(0, 3).map(d => d.day);
    const worstDays = dayAverages.slice(-3).map(d => d.day);

    const avgDuration =
      this.sessions.reduce((sum, s) => sum + s.duration, 0) / this.sessions.length;

    const variance =
      this.sessions.reduce((sum, s) => Math.pow(s.quality - 75, 2), 0) /
      this.sessions.length;
    const consistency = Math.max(0, 100 - Math.sqrt(variance));

    this.circadianProfile = {
      peakHours,
      troughHours,
      averageFocusDuration: Math.round(avgDuration),
      bestDays,
      worstDays,
      consistencyScore: Math.round(consistency),
    };
  }

  predictOptimalFocusTime(date: Date = new Date()): FocusPredictionResult {
    const currentHour = getHours(date);
    const currentDay = getDay(date);

    const windows: FocusPredictionResult['optimalWindows'] = [];
    const factors: string[] = [];

    if (!this.circadianProfile) {
      return this.getDefaultPrediction(date);
    }

    const isPeakHour = this.circadianProfile.peakHours.includes(currentHour);
    const isTroughHour = this.circadianProfile.troughHours.includes(currentHour);
    const isGoodDay = this.circadianProfile.bestDays.includes(currentDay);
    const isBadDay = this.circadianProfile.worstDays.includes(currentDay);

    let currentPotential = 50;

    if (isPeakHour) {
      currentPotential += 25;
      factors.push('Horário de pico de foco detectado');
    }
    if (isGoodDay) {
      currentPotential += 10;
      factors.push('Dia historicamente produtivo');
    }
    if (isTroughHour) {
      currentPotential -= 20;
      factors.push('Horário de baixa energia');
    }
    if (isBadDay) {
      currentPotential -= 10;
      factors.push('Dia com menor produtividade histórica');
    }

    const recentSessions = this.sessions.filter(
      s => s.startTime > Date.now() - 24 * 60 * 60 * 1000
    );
    const recentFatigue = recentSessions.reduce((sum, s) => sum + s.duration, 0);

    if (recentFatigue > 300) {
      currentPotential -= 15;
      factors.push('Fadiga acumulada nas últimas 24h');
    }

    currentPotential = Math.max(10, Math.min(95, currentPotential));

    const nextOptimal = this.findNextOptimalTime(date);

    for (const peakHour of this.circadianProfile.peakHours) {
      const start = addHours(startOfDay(date), peakHour);
      const end = addHours(start, 1.5);
      
      windows.push({
        start: start.getTime(),
        end: end.getTime(),
        confidence: this.calculateWindowConfidence(peakHour, currentDay),
        predictedQuality: 70 + Math.random() * 25,
      });
    }

    windows.sort((a, b) => b.confidence - a.confidence);

    const recommendation = this.generateRecommendation(
      currentPotential,
      isPeakHour,
      nextOptimal
    );

    return {
      optimalWindows: windows.slice(0, 3),
      currentFocusPotential: Math.round(currentPotential),
      recommendation,
      nextOptimalTime: nextOptimal,
      factors,
    };
  }

  private getDefaultPrediction(date: Date): FocusPredictionResult {
    const hour = getHours(date);
    const isTypicalWorkHour = hour >= 9 && hour <= 17;

    return {
      optimalWindows: [
        { start: addHours(startOfDay(date), 9).getTime(), end: addHours(startOfDay(date), 11).getTime(), confidence: 0.7, predictedQuality: 75 },
        { start: addHours(startOfDay(date), 14).getTime(), end: addHours(startOfDay(date), 16).getTime(), confidence: 0.6, predictedQuality: 70 },
        { start: addHours(startOfDay(date), 19).getTime(), end: addHours(startOfDay(date), 21).getTime(), confidence: 0.5, predictedQuality: 65 },
      ],
      currentFocusPotential: isTypicalWorkHour ? 60 : 40,
      recommendation: isTypicalWorkHour
        ? 'Horário típico de trabalho. Use a técnica Pomodoro para manter o foco.'
        : 'Fora do horário habitual. Considere sessões mais curtas.',
      nextOptimalTime: addHours(startOfDay(date), 9),
      factors: ['Padrões ainda sendo aprendidos'],
    };
  }

  private calculateWindowConfidence(hour: number, day: number): number {
    if (!this.circadianProfile) return 0.5;

    const hourMatch = this.circadianProfile.peakHours.includes(hour) ? 0.3 : 0;
    const dayMatch = this.circadianProfile.bestDays.includes(day) ? 0.2 : 0;
    const consistency = this.circadianProfile.consistencyScore / 100;

    return Math.min(0.95, 0.4 + hourMatch + dayMatch + consistency * 0.3);
  }

  private findNextOptimalTime(fromDate: Date): Date | null {
    if (!this.circadianProfile) return null;

    const currentHour = getHours(fromDate);
    const currentDay = getDay(fromDate);

    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const _checkDay = (currentDay + dayOffset) % 7;
      
      for (const peakHour of this.circadianProfile.peakHours) {
        if (dayOffset === 0 && peakHour <= currentHour) continue;

        const nextTime = addHours(startOfDay(fromDate), peakHour + dayOffset * 24);
        return nextTime;
      }
    }

    return null;
  }

  private generateRecommendation(
    potential: number,
    isPeak: boolean,
    nextOptimal: Date | null
  ): string {
    if (potential >= 80) {
      return isPeak
        ? 'Momento ideal para foco profundo. Aproveite!'
        : 'Condições excelentes para foco.';
    }

    if (potential >= 60) {
      return 'Bom momento para trabalho focado com técnicas de apoio.';
    }

    if (potential >= 40) {
      if (nextOptimal) {
        return `Foco moderado. Próximo horário ótimo: ${format(nextOptimal, 'HH:mm')}`;
      }
      return 'Foco moderado. Use sessões curtas de 15 minutos.';
    }

    if (nextOptimal) {
      return `Foco baixo. Melhor esperar até ${format(nextOptimal, 'HH:mm')}`;
    }

    return 'Momento de baixa energia. Considere uma pausa ativa.';
  }

  predictSessionQuality(duration: number, startTime: Date): number {
    if (!this.circadianProfile) return 60;

    const hour = getHours(startTime);
    const day = getDay(startTime);

    let baseScore = 60;

    if (this.circadianProfile.peakHours.includes(hour)) baseScore += 20;
    if (this.circadianProfile.bestDays.includes(day)) baseScore += 10;
    if (this.circadianProfile.troughHours.includes(hour)) baseScore -= 15;

    const optimalDuration = this.circadianProfile.averageFocusDuration;
    if (Math.abs(duration - optimalDuration) < 10) baseScore += 10;

    const recentQuality = this.sessions
      .slice(-5)
      .reduce((sum, s) => sum + s.quality, 0) / 5;
    baseScore += (recentQuality - 70) * 0.3;

    return Math.max(20, Math.min(95, Math.round(baseScore)));
  }

  getEnergyForecast(hours: number = 12): Array<{ hour: number; energy: number }> {
    if (!this.circadianProfile) {
      return Array.from({ length: hours }, (_, i) => ({
        hour: (getHours(new Date()) + i) % 24,
        energy: 50,
      }));
    }

    const now = new Date();
    const forecast: Array<{ hour: number; energy: number }> = [];

    for (let i = 0; i < hours; i++) {
      const hour = (getHours(now) + i) % 24;
      let energy = 50;

      if (this.circadianProfile.peakHours.includes(hour)) energy += 30;
      if (this.circadianProfile.troughHours.includes(hour)) energy -= 20;

      forecast.push({ hour, energy: Math.max(10, Math.min(100, energy)) });
    }

    return forecast;
  }

  getInsights(): string[] {
    if (!this.circadianProfile) {
      return ['Continue usando o app para aprender seus padrões de foco.'];
    }

    const insights: string[] = [];
    const profile = this.circadianProfile;

    if (profile.peakHours.length > 0) {
      const peakTimes = profile.peakHours
        .slice(0, 2)
        .map(h => `${h}:00`)
        .join(' e ');
      insights.push(`Seus melhores horários de foco são por volta de ${peakTimes}.`);
    }

    if (profile.consistencyScore > 70) {
      insights.push('Você mantém um padrão de foco muito consistente.');
    } else if (profile.consistencyScore < 40) {
      insights.push('Seus horários de foco variam bastante. Tente criar uma rotina.');
    }

    const avgDuration = Math.round(profile.averageFocusDuration);
    if (avgDuration > 45) {
      insights.push(`Suas sessões médias têm ${avgDuration}min. Considere pausas mais frequentes.`);
    } else if (avgDuration < 15) {
      insights.push('Suas sessões são curtas. Tente estender gradualmente para 25min.');
    }

    const recentSessions = this.sessions.slice(-7);
    const avgQuality =
      recentSessions.reduce((sum, s) => sum + s.quality, 0) /
      (recentSessions.length || 1);

    if (avgQuality > 80) {
      insights.push('Qualidade de foco excelente nas sessões recentes!');
    } else if (avgQuality < 50) {
      insights.push('Qualidade de foco baixa. Verifique possíveis distrações.');
    }

    return insights;
  }

  getCircadianProfile(): CircadianProfile | null {
    return this.circadianProfile;
  }

  getSessionStats(): {
    totalSessions: number;
    averageDuration: number;
    averageQuality: number;
    totalFocusTime: number;
  } {
    if (this.sessions.length === 0) {
      return {
        totalSessions: 0,
        averageDuration: 0,
        averageQuality: 0,
        totalFocusTime: 0,
      };
    }

    const totalDuration = this.sessions.reduce((sum, s) => sum + s.duration, 0);
    const totalQuality = this.sessions.reduce((sum, s) => sum + s.quality, 0);

    return {
      totalSessions: this.sessions.length,
      averageDuration: Math.round(totalDuration / this.sessions.length),
      averageQuality: Math.round(totalQuality / this.sessions.length),
      totalFocusTime: Math.round(totalDuration / 60),
    };
  }

  clearData(): void {
    this.sessions = [];
    this.circadianProfile = null;
    this.energyHistory = [];
    void AsyncStorage.removeItem(FOCUS_SESSIONS_KEY);
    void AsyncStorage.removeItem(CIRCADIAN_KEY);
  }
}

export const focusPrediction = new FocusPredictionService();
