import { CognitiveMetricsSnapshot, FocusSessionAnalysis, InteractionEvent } from '@/types/ai';
import { CognitiveState } from '@/types/mindease';

interface SessionWindow {
  events: InteractionEvent[];
  startTime: number;
  endTime: number;
  durationMinutes: number;
}

export class CognitiveAnalyticsEngine {
  private eventHistory: InteractionEvent[] = [];
  private readonly maxHistorySize = 1000;
  private readonly flowStateThreshold = 0.75;

  constructor() {
    this.eventHistory = [];
  }

  recordEvent(event: Omit<InteractionEvent, 'id'>): void {
    const newEvent: InteractionEvent = {
      ...event,
      id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };

    this.eventHistory.push(newEvent);

    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory = this.eventHistory.slice(-this.maxHistorySize);
    }
  }

  calculateFocusScore(state: CognitiveState, windowMinutes: number = 5): number {
    const now = Date.now();
    const windowStart = now - windowMinutes * 60 * 1000;

    const recentEvents = this.eventHistory.filter(e => e.timestamp >= windowStart);
    const _focusEvents = recentEvents.filter(e => 
      e.type === 'focus_start' || e.type === 'focus_end'
    );

    const taskSwitches = recentEvents.filter(e => e.type === 'task_switch').length;
    const interruptions = recentEvents.filter(e => 
      e.type === 'dismiss' || e.type === 'tap'
    ).length;

    const sessionTime = state.sessionDurationMinutes;
    const baseScore = Math.max(0, 100 - state.overloadIndex * 0.8);

    const switchPenalty = Math.min(30, taskSwitches * 3);
    const interruptionPenalty = Math.min(20, interruptions * 2);
    const staminaBonus = Math.max(0, 10 - sessionTime * 0.15);

    const rawScore = baseScore - switchPenalty - interruptionPenalty + staminaBonus;
    return Math.max(0, Math.min(100, rawScore));
  }

  calculateOverloadIndex(
    state: CognitiveState, 
    recentEvents: InteractionEvent[]
  ): number {
    const now = Date.now();
    const fiveMinWindow = recentEvents.filter(e => 
      e.timestamp >= now - 5 * 60 * 1000
    );

    const taskSwitchRate = fiveMinWindow.filter(e => e.type === 'task_switch').length;
    const interruptionRate = fiveMinWindow.filter(e => 
      e.type === 'tap' || e.type === 'dismiss'
    ).length;

    const sustainedFocus = fiveMinWindow.filter(e => 
      e.type === 'focus_start'
    ).length;

    const sessionFatigue = state.sessionDurationMinutes * 0.5;
    const contextSwitchLoad = taskSwitchRate * 4;
    const interruptionLoad = interruptionRate * 2;
    const focusRecovery = sustainedFocus > 0 ? -5 : 0;

    const rawIndex = sessionFatigue + contextSwitchLoad + interruptionLoad + focusRecovery;
    
    return Math.max(0, Math.min(100, rawIndex));
  }

  calculateTaskSwitchRate(windowMinutes: number = 10): number {
    const now = Date.now();
    const windowStart = now - windowMinutes * 60 * 1000;

    const switches = this.eventHistory.filter(e => 
      e.type === 'task_switch' && e.timestamp >= windowStart
    ).length;

    return switches / windowMinutes;
  }

  calculateAverageFocusDuration(windowHours: number = 24): number {
    const sessions = this.extractFocusSessions(windowHours);
    
    if (sessions.length === 0) return 0;

    const totalDuration = sessions.reduce((sum, s) => sum + s.durationMinutes, 0);
    return totalDuration / sessions.length;
  }

  calculateFlowStateScore(_state: CognitiveState): number {
    const recentEvents = this.getRecentEvents(10);
    
    const focusStarts = recentEvents.filter(e => e.type === 'focus_start').length;
    const focusEnds = recentEvents.filter(e => e.type === 'focus_end').length;
    const taskSwitches = recentEvents.filter(e => e.type === 'task_switch').length;

    if (focusStarts === 0) return 0;

    const sustainedRatio = focusEnds / Math.max(focusStarts, 1);
    const switchRatio = taskSwitches / Math.max(focusStarts, 1);

    const flowScore = (sustainedRatio * 0.6 + (1 - switchRatio) * 0.4) * 100;
    
    return Math.max(0, Math.min(100, flowScore));
  }

  generateMetricsSnapshot(state: CognitiveState): CognitiveMetricsSnapshot {
    return {
      timestamp: Date.now(),
      focusScore: this.calculateFocusScore(state),
      overloadIndex: this.calculateOverloadIndex(state, this.getRecentEvents(5)),
      sessionDuration: state.sessionDurationMinutes,
      taskSwitchRate: this.calculateTaskSwitchRate(),
      averageFocusDuration: this.calculateAverageFocusDuration(),
      interruptionCount: this.countRecentInterruptions(5),
      flowStateScore: this.calculateFlowStateScore(state),
    };
  }

  analyzeFocusSession(sessionId: string): FocusSessionAnalysis | null {
    const session = this.extractFocusSessionById(sessionId);
    if (!session) return null;

    const events = session.events;
    const duration = (session.endTime - session.startTime) / 60000;

    const attentionDrops = this.detectAttentionDrops(events);
    const flowStates = this.detectFlowStates(events);
    const peakFocusTime = this.calculatePeakFocusTime(events);

    const focusScore = this.calculateSessionFocusScore(events, duration);
    const productivityScore = this.calculateProductivityScore(
      duration, 
      attentionDrops.length, 
      flowStates.length
    );

    return {
      sessionId,
      startTime: session.startTime,
      endTime: session.endTime,
      durationMinutes: duration,
      focusScore,
      peakFocusTime,
      attentionDrops,
      flowStates,
      productivityScore,
    };
  }

  private detectAttentionDrops(events: InteractionEvent[]): Array<{ timestamp: number; severity: number }> {
    const drops: Array<{ timestamp: number; severity: number }> = [];
    
    for (let i = 1; i < events.length; i++) {
      const gap = events[i].timestamp - events[i - 1].timestamp;
      
      if (gap > 30000) {
        drops.push({
          timestamp: events[i].timestamp,
          severity: Math.min(1, gap / 120000),
        });
      }
    }

    return drops;
  }

  private detectFlowStates(events: InteractionEvent[]): Array<{ start: number; end: number; quality: number }> {
    const flows: Array<{ start: number; end: number; quality: number }> = [];
    let currentFlow: { start: number; events: number } | null = null;

    for (const event of events) {
      if (event.type === 'focus_start') {
        currentFlow = { start: event.timestamp, events: 1 };
      } else if (event.type === 'focus_end' && currentFlow) {
        const duration = event.timestamp - currentFlow.start;
        const quality = Math.min(1, duration / 900000);
        
        if (quality >= this.flowStateThreshold) {
          flows.push({
            start: currentFlow.start,
            end: event.timestamp,
            quality,
          });
        }
        currentFlow = null;
      } else if (currentFlow) {
        currentFlow.events++;
      }
    }

    return flows;
  }

  private calculatePeakFocusTime(events: InteractionEvent[]): number {
    if (events.length === 0) return 0;

    const focusPeriods: Array<{ start: number; duration: number }> = [];
    let focusStart: number | null = null;

    for (const event of events) {
      if (event.type === 'focus_start') {
        focusStart = event.timestamp;
      } else if (event.type === 'focus_end' && focusStart) {
        focusPeriods.push({
          start: focusStart,
          duration: event.timestamp - focusStart,
        });
        focusStart = null;
      }
    }

    if (focusPeriods.length === 0) return 0;

    const longestPeriod = focusPeriods.reduce((max, p) => 
      p.duration > max.duration ? p : max
    );

    return longestPeriod.start + longestPeriod.duration / 2;
  }

  private calculateSessionFocusScore(events: InteractionEvent[], duration: number): number {
    const productiveEvents = events.filter(e => 
      e.type === 'complete' || e.type === 'focus_end'
    ).length;

    const disruptiveEvents = events.filter(e => 
      e.type === 'task_switch' || e.type === 'dismiss'
    ).length;

    const baseScore = Math.min(100, productiveEvents * 10);
    const penalty = Math.min(50, disruptiveEvents * 5);
    const durationBonus = Math.min(20, duration / 5);

    return Math.max(0, Math.min(100, baseScore - penalty + durationBonus));
  }

  private calculateProductivityScore(
    duration: number, 
    attentionDrops: number, 
    flowStates: number
  ): number {
    const durationScore = Math.min(40, duration / 2.5);
    const focusScore = Math.min(40, flowStates * 10);
    const consistencyScore = Math.max(0, 20 - attentionDrops * 2);

    return Math.min(100, durationScore + focusScore + consistencyScore);
  }

  private getRecentEvents(minutes: number): InteractionEvent[] {
    const cutoff = Date.now() - minutes * 60 * 1000;
    return this.eventHistory.filter(e => e.timestamp >= cutoff);
  }

  private countRecentInterruptions(minutes: number): number {
    return this.getRecentEvents(minutes).filter(e => 
      e.type === 'dismiss' || e.type === 'tap'
    ).length;
  }

  private extractFocusSessions(hours: number): SessionWindow[] {
    const cutoff = Date.now() - hours * 60 * 60 * 1000;
    const relevantEvents = this.eventHistory.filter(e => e.timestamp >= cutoff);

    const sessions: SessionWindow[] = [];
    let currentSession: InteractionEvent[] = [];
    let sessionStart: number | null = null;

    for (const event of relevantEvents) {
      if (event.type === 'focus_start' && !sessionStart) {
        sessionStart = event.timestamp;
        currentSession = [event];
      } else if (event.type === 'focus_end' && sessionStart) {
        currentSession.push(event);
        sessions.push({
          events: currentSession,
          startTime: sessionStart,
          endTime: event.timestamp,
          durationMinutes: (event.timestamp - sessionStart) / 60000,
        });
        sessionStart = null;
        currentSession = [];
      } else if (sessionStart) {
        currentSession.push(event);
      }
    }

    return sessions;
  }

  private extractFocusSessionById(_sessionId: string): SessionWindow | null {
    return null;
  }

  clearHistory(): void {
    this.eventHistory = [];
  }

  exportData(): InteractionEvent[] {
    return [...this.eventHistory];
  }
}

export const cognitiveAnalytics = new CognitiveAnalyticsEngine();
