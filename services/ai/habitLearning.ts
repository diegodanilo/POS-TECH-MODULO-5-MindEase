import AsyncStorage from '@react-native-async-storage/async-storage';
import { addDays, format, getDay, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface HabitPattern {
  id: string;
  type: 'focus_time' | 'task_completion' | 'break_pattern' | 'app_usage';
  dayOfWeek: number;
  hourOfDay: number;
  frequency: number;
  consistency: number;
  lastObserved: number;
  confidence: number;
}

interface UserHabit {
  preferredFocusHours: number[];
  preferredBreakInterval: number;
  productiveDays: number[];
  taskCompletionRate: number;
  commonTaskTypes: string[];
  stressTriggers: string[];
  recoveryPatterns: {
    afterHighStress: number;
    typicalBreakDuration: number;
  };
}

interface HabitPrediction {
  bestFocusTimes: Array<{ hour: number; score: number }>;
  predictedProductivity: number;
  recommendedTasks: string[];
  suggestedBreaks: number[];
  riskOfBurnout: number;
}

interface DailyRoutine {
  typicalStartHour: number;
  typicalEndHour: number;
  peakFocusWindow: { start: number; end: number };
  commonBreakTimes: number[];
}

const HABIT_STORAGE_KEY = 'mindease_habit_data';
const PATTERNS_KEY = 'mindease_patterns';

export class HabitLearningService {
  private patterns: HabitPattern[] = [];
  private userHabit: UserHabit | null = null;
  private dailyRoutine: DailyRoutine | null = null;
  private interactionHistory: Array<{
    timestamp: number;
    type: string;
    metadata: Record<string, unknown>;
  }> = [];

  async initialize(): Promise<void> {
    await this.loadStoredData();
  }

  private async loadStoredData(): Promise<void> {
    try {
      const [patternsData, habitData] = await Promise.all([
        AsyncStorage.getItem(PATTERNS_KEY),
        AsyncStorage.getItem(HABIT_STORAGE_KEY),
      ]);

      if (patternsData) {
        this.patterns = JSON.parse(patternsData);
      }

      if (habitData) {
        const parsed = JSON.parse(habitData);
        this.userHabit = parsed.userHabit;
        this.dailyRoutine = parsed.dailyRoutine;
        this.interactionHistory = parsed.interactionHistory || [];
      }
    } catch (error) {
      console.warn('Failed to load habit data:', error);
    }
  }

  private async saveData(): Promise<void> {
    try {
      await AsyncStorage.setItem(PATTERNS_KEY, JSON.stringify(this.patterns));
      await AsyncStorage.setItem(
        HABIT_STORAGE_KEY,
        JSON.stringify({
          userHabit: this.userHabit,
          dailyRoutine: this.dailyRoutine,
          interactionHistory: this.interactionHistory.slice(-1000),
        })
      );
    } catch (error) {
      console.warn('Failed to save habit data:', error);
    }
  }

  recordInteraction(type: string, metadata: Record<string, unknown>): void {
    const interaction = {
      timestamp: Date.now(),
      type,
      metadata,
    };

    this.interactionHistory.push(interaction);
    this.analyzeAndUpdatePatterns(interaction);

    if (this.interactionHistory.length % 10 === 0) {
      void this.saveData();
    }
  }

  private analyzeAndUpdatePatterns(
    interaction: typeof this.interactionHistory[0]
  ): void {
    const date = new Date(interaction.timestamp);
    const dayOfWeek = getDay(date);
    const hourOfDay = date.getHours();

    switch (interaction.type) {
      case 'focus_start':
        this.updatePattern('focus_time', dayOfWeek, hourOfDay);
        break;
      case 'task_complete':
        this.updatePattern('task_completion', dayOfWeek, hourOfDay);
        break;
      case 'break_taken':
        this.updatePattern('break_pattern', dayOfWeek, hourOfDay);
        break;
      case 'app_open':
        this.updatePattern('app_usage', dayOfWeek, hourOfDay);
        break;
    }

    this.recalculateUserHabit();
  }

  private updatePattern(
    type: HabitPattern['type'],
    dayOfWeek: number,
    hourOfDay: number
  ): void {
    const existingPattern = this.patterns.find(
      p => p.type === type && p.dayOfWeek === dayOfWeek && p.hourOfDay === hourOfDay
    );

    if (existingPattern) {
      existingPattern.frequency++;
      existingPattern.lastObserved = Date.now();
      existingPattern.consistency = this.calculateConsistency(existingPattern);
      existingPattern.confidence = Math.min(1, existingPattern.frequency / 10);
    } else {
      this.patterns.push({
        id: `pattern_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type,
        dayOfWeek,
        hourOfDay,
        frequency: 1,
        consistency: 0.5,
        lastObserved: Date.now(),
        confidence: 0.1,
      });
    }
  }

  private calculateConsistency(pattern: HabitPattern): number {
    const daysSinceLast =
      (Date.now() - pattern.lastObserved) / (1000 * 60 * 60 * 24);
    const recencyBonus = Math.max(0, 1 - daysSinceLast / 30);
    return Math.min(1, (pattern.frequency / 20) * recencyBonus + 0.3);
  }

  private recalculateUserHabit(): void {
    const focusPatterns = this.patterns.filter(p => p.type === 'focus_time');
    const breakPatterns = this.patterns.filter(p => p.type === 'break_pattern');
    const taskPatterns = this.patterns.filter(p => p.type === 'task_completion');

    const preferredHours = focusPatterns
      .filter(p => p.confidence > 0.3)
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 5)
      .map(p => p.hourOfDay);

    const productiveDays = [...new Set(
      taskPatterns
        .filter(p => p.frequency > 3)
        .map(p => p.dayOfWeek)
    )];

    const totalAttempts = this.interactionHistory.filter(
      i => i.type === 'task_start'
    ).length;
    const totalCompletions = this.interactionHistory.filter(
      i => i.type === 'task_complete'
    ).length;
    const completionRate =
      totalAttempts > 0 ? (totalCompletions / totalAttempts) * 100 : 0;

    const taskTypes = this.extractCommonTaskTypes();

    const typicalBreak = breakPatterns.length > 0
      ? breakPatterns.reduce((sum, p) => sum + p.hourOfDay, 0) / breakPatterns.length
      : 45;

    this.userHabit = {
      preferredFocusHours: preferredHours,
      preferredBreakInterval: Math.round(typicalBreak),
      productiveDays,
      taskCompletionRate: Math.round(completionRate),
      commonTaskTypes: taskTypes,
      stressTriggers: this.identifyStressTriggers(),
      recoveryPatterns: this.analyzeRecoveryPatterns(),
    };

    this.calculateDailyRoutine();
  }

  private extractCommonTaskTypes(): string[] {
    const taskInteractions = this.interactionHistory.filter(
      i => i.type === 'task_complete' && i.metadata?.taskType
    );

    const typeCounts: Record<string, number> = {};
    taskInteractions.forEach(i => {
      const type = i.metadata.taskType as string;
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    });

    return Object.entries(typeCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([type]) => type);
  }

  private identifyStressTriggers(): string[] {
    const highStressPeriods = this.interactionHistory.filter(
      i => i.type === 'stress_detected' || (i.metadata?.stressLevel as number) > 70
    );

    const triggers = highStressPeriods
      .map(i => i.metadata.trigger as string)
      .filter(Boolean);

    return [...new Set(triggers)].slice(0, 5);
  }

  private analyzeRecoveryPatterns(): UserHabit['recoveryPatterns'] {
    const recoveryTimes: number[] = [];
    const breakDurations: number[] = [];

    for (let i = 0; i < this.interactionHistory.length - 1; i++) {
      const current = this.interactionHistory[i];
      const next = this.interactionHistory[i + 1];

      if (current.type === 'stress_detected' && next.type === 'normal_state') {
        recoveryTimes.push(next.timestamp - current.timestamp);
      }

      if (current.type === 'break_start' && next.type === 'break_end') {
        breakDurations.push(next.timestamp - current.timestamp);
      }
    }

    const avgRecovery =
      recoveryTimes.length > 0
        ? recoveryTimes.reduce((a, b) => a + b, 0) / recoveryTimes.length / 60000
        : 15;

    const avgBreak =
      breakDurations.length > 0
        ? breakDurations.reduce((a, b) => a + b, 0) / breakDurations.length / 60000
        : 5;

    return {
      afterHighStress: Math.round(avgRecovery),
      typicalBreakDuration: Math.round(avgBreak),
    };
  }

  private calculateDailyRoutine(): void {
    const appUsage = this.patterns.filter(p => p.type === 'app_usage');
    const focusTimes = this.patterns.filter(p => p.type === 'focus_time');

    if (appUsage.length === 0) return;

    const hours = appUsage.map(p => p.hourOfDay).sort((a, b) => a - b);
    const startHour = hours[0] || 9;
    const endHour = hours[hours.length - 1] || 18;

    const focusHours = focusTimes
      .filter(p => p.confidence > 0.3)
      .map(p => p.hourOfDay)
      .sort((a, b) => a - b);

    const peakStart = focusHours[0] || startHour + 1;
    const peakEnd = focusHours[focusHours.length - 1] || peakStart + 3;

    const breakTimes = this.patterns
      .filter(p => p.type === 'break_pattern')
      .map(p => p.hourOfDay);

    this.dailyRoutine = {
      typicalStartHour: startHour,
      typicalEndHour: endHour,
      peakFocusWindow: { start: peakStart, end: peakEnd },
      commonBreakTimes: [...new Set(breakTimes)].sort((a, b) => a - b),
    };
  }

  predictForDate(date: Date = new Date()): HabitPrediction {
    const dayOfWeek = getDay(date);
    const relevantPatterns = this.patterns.filter(
      p => p.dayOfWeek === dayOfWeek && p.confidence > 0.2
    );

    const focusScores = new Map<number, number>();

    relevantPatterns
      .filter(p => p.type === 'focus_time')
      .forEach(p => {
        const current = focusScores.get(p.hourOfDay) || 0;
        focusScores.set(p.hourOfDay, current + p.frequency * p.consistency);
      });

    const bestFocusTimes = Array.from(focusScores.entries())
      .map(([hour, score]) => ({ hour, score: Math.round(score * 10) / 10 }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    const productivityScore = this.calculateProductivityScore(dayOfWeek);

    const recommendedTasks = this.userHabit?.commonTaskTypes.slice(0, 3) || [];

    const suggestedBreaks = this.dailyRoutine?.commonBreakTimes.slice(0, 3) || [
      10, 14, 16,
    ];

    const recentStress = this.interactionHistory
      .slice(-50)
      .filter(i => i.type === 'stress_detected').length;
    const burnoutRisk = Math.min(100, recentStress * 5);

    return {
      bestFocusTimes,
      predictedProductivity: Math.round(productivityScore),
      recommendedTasks,
      suggestedBreaks,
      riskOfBurnout: burnoutRisk,
    };
  }

  private calculateProductivityScore(dayOfWeek: number): number {
    const dayPatterns = this.patterns.filter(
      p => p.dayOfWeek === dayOfWeek && p.type === 'task_completion'
    );

    if (dayPatterns.length === 0) return 70;

    const avgFrequency =
      dayPatterns.reduce((sum, p) => sum + p.frequency, 0) / dayPatterns.length;
    const avgConsistency =
      dayPatterns.reduce((sum, p) => sum + p.consistency, 0) / dayPatterns.length;

    return Math.min(100, avgFrequency * 10 + avgConsistency * 30 + 50);
  }

  getUserHabit(): UserHabit | null {
    return this.userHabit;
  }

  getDailyRoutine(): DailyRoutine | null {
    return this.dailyRoutine;
  }

  getPatterns(): HabitPattern[] {
    return this.patterns;
  }

  generateWeeklySchedule(): Array<{
    day: string;
    recommendedHours: number[];
    avoidHours: number[];
  }> {
    const schedule: ReturnType<typeof this.generateWeeklySchedule> = [];

    for (let day = 0; day < 7; day++) {
      const dayName = format(addDays(startOfDay(new Date()), day), 'EEEE', {
        locale: ptBR,
      });

      const dayPatterns = this.patterns.filter(
        p => p.dayOfWeek === day && p.confidence > 0.2
      );

      const focusHours = dayPatterns
        .filter(p => p.type === 'focus_time')
        .sort((a, b) => b.frequency - a.frequency)
        .slice(0, 3)
        .map(p => p.hourOfDay);

      const lowEnergyHours = dayPatterns
        .filter(p => p.type === 'break_pattern' && p.frequency > 5)
        .map(p => p.hourOfDay);

      schedule.push({
        day: dayName.charAt(0).toUpperCase() + dayName.slice(1),
        recommendedHours: focusHours.length > 0 ? focusHours : [9, 14, 16],
        avoidHours: lowEnergyHours,
      });
    }

    return schedule;
  }

  clearAllData(): void {
    this.patterns = [];
    this.userHabit = null;
    this.dailyRoutine = null;
    this.interactionHistory = [];
    void AsyncStorage.removeItem(PATTERNS_KEY);
    void AsyncStorage.removeItem(HABIT_STORAGE_KEY);
  }
}

export const habitLearning = new HabitLearningService();
