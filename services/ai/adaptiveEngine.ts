import { ComplexityAdjustment, OverloadPrediction } from '@/types/ai';
import { CognitiveComplexity, CognitiveProfile, CognitiveState } from '@/types/mindease';

interface AdaptationRule {
  id: string;
  condition: (state: CognitiveState, history: AdaptationHistory) => boolean;
  action: (state: CognitiveState, profile: CognitiveProfile) => ComplexityAdjustment;
  priority: number;
  cooldownMinutes: number;
}

interface AdaptationHistory {
  adjustments: Array<{
    timestamp: number;
    fromLevel: CognitiveComplexity;
    toLevel: CognitiveComplexity;
    reason: string;
  }>;
  lastAdjustmentTime: number;
}

interface UIAdjustment {
  complexity: CognitiveComplexity;
  animations: {
    enabled: boolean;
    duration: number;
    intensity: 'low' | 'medium' | 'high';
  };
  typography: {
    scale: number;
    lineHeight: number;
    letterSpacing: number;
  };
  layout: {
    density: 'compact' | 'comfortable' | 'spacious';
    maxVisibleItems: number;
    cardElevation: number;
  };
  colors: {
    contrast: 'normal' | 'high';
    saturation: number;
    brightness: number;
  };
}

const DEFAULT_HISTORY: AdaptationHistory = {
  adjustments: [],
  lastAdjustmentTime: 0,
};

const ADAPTATION_RULES: AdaptationRule[] = [
  {
    id: 'overload_critical',
    condition: (state) => state.overloadIndex >= 80,
    action: (state, profile) => ({
      currentLevel: profile.complexity,
      suggestedLevel: 1,
      reason: 'Sobrecarga cognitiva crítica detectada. Redução imediata de estímulos visuais.',
      confidence: 0.95,
      triggers: ['overloadIndex >= 80', 'sessionDuration > threshold'],
    }),
    priority: 1,
    cooldownMinutes: 10,
  },
  {
    id: 'overload_moderate',
    condition: (state) => state.overloadIndex >= 60 && state.overloadIndex < 80,
    action: (state, profile) => ({
      currentLevel: profile.complexity,
      suggestedLevel: Math.max(1, profile.complexity - 1) as CognitiveComplexity,
      reason: 'Sobrecarga moderada. Reduzindo complexidade para manter foco.',
      confidence: 0.8,
      triggers: ['overloadIndex >= 60', 'taskSwitchCount elevated'],
    }),
    priority: 2,
    cooldownMinutes: 15,
  },
  {
    id: 'high_focus_sustained',
    condition: (state) => state.focusScore >= 85 && state.sessionDurationMinutes >= 20,
    action: (state, profile) => ({
      currentLevel: profile.complexity,
      suggestedLevel: Math.min(3, profile.complexity + 1) as CognitiveComplexity,
      reason: 'Foco sustentado detectado. Aumentando complexidade para aproveitar o estado de flow.',
      confidence: 0.75,
      triggers: ['focusScore >= 85', 'sessionDuration >= 20'],
    }),
    priority: 3,
    cooldownMinutes: 30,
  },
  {
    id: 'frequent_switching',
    condition: (state) => state.taskSwitchCount >= 5 && state.sessionDurationMinutes < 10,
    action: (state, profile) => ({
      currentLevel: profile.complexity,
      suggestedLevel: 1,
      reason: 'Alternância frequente de tarefas detectada. Simplificando interface para reduzir distrações.',
      confidence: 0.85,
      triggers: ['taskSwitchCount >= 5', 'early_session'],
    }),
    priority: 2,
    cooldownMinutes: 10,
  },
  {
    id: 'fatigue_detected',
    condition: (state) => state.sessionDurationMinutes >= 45 && state.focusScore < 60,
    action: (state, profile) => ({
      currentLevel: profile.complexity,
      suggestedLevel: 1,
      reason: 'Fadiga de longa sessão detectada. Reduzindo carga cognitiva e sugerindo pausa.',
      confidence: 0.9,
      triggers: ['sessionDuration >= 45', 'focusScore declining'],
    }),
    priority: 1,
    cooldownMinutes: 20,
  },
];

export class AdaptiveEngine {
  private history: AdaptationHistory = DEFAULT_HISTORY;
  private currentUIState: UIAdjustment | null = null;
  private readonly maxHistorySize = 50;

  evaluateAdaptation(
    state: CognitiveState,
    profile: CognitiveProfile
  ): ComplexityAdjustment | null {
    const applicableRules = ADAPTATION_RULES
      .filter(rule => this.isRuleApplicable(rule, state))
      .sort((a, b) => a.priority - b.priority);

    if (applicableRules.length === 0) return null;

    const selectedRule = applicableRules[0];
    const adjustment = selectedRule.action(state, profile);

    if (adjustment.suggestedLevel !== profile.complexity) {
      this.recordAdjustment(adjustment);
      return adjustment;
    }

    return null;
  }

  predictOverload(
    state: CognitiveState,
    _trendWindowMinutes: number = 10
  ): OverloadPrediction {
    const currentOverload = state.overloadIndex;
    const sessionTime = state.sessionDurationMinutes;
    const switchRate = state.taskSwitchCount / Math.max(sessionTime / 5, 1);

    const factors: string[] = [];
    let probability = 0;
    let timeToOverload = Infinity;

    if (currentOverload >= 60) {
      factors.push('Sobrecarga atual elevada');
      probability += 0.4;
    }

    if (switchRate > 2) {
      factors.push('Taxa de alternância alta');
      probability += 0.3;
    }

    if (sessionTime > 30 && state.focusScore < 70) {
      factors.push('Fadiga de sessão prolongada');
      probability += 0.2;
    }

    if (currentOverload >= 40 && currentOverload < 60) {
      const projectedRate = (60 - currentOverload) / (switchRate * 2 + 1);
      timeToOverload = projectedRate * 5;
    }

    probability = Math.min(1, probability);

    let recommendedAction: OverloadPrediction['recommendedAction'] = 'maintain';
    let urgency: OverloadPrediction['urgency'] = 'low';

    if (probability >= 0.8) {
      recommendedAction = 'break_now';
      urgency = 'critical';
    } else if (probability >= 0.6) {
      recommendedAction = 'reduce_complexity';
      urgency = 'high';
    } else if (probability >= 0.4) {
      recommendedAction = 'reduce_complexity';
      urgency = 'medium';
    }

    return {
      probability: Math.round(probability * 100) / 100,
      estimatedTimeToOverload: timeToOverload === Infinity ? -1 : Math.round(timeToOverload),
      contributingFactors: factors,
      recommendedAction,
      urgency,
    };
  }

  generateUIAdjustment(
    complexity: CognitiveComplexity,
    profile: CognitiveProfile
  ): UIAdjustment {
    const baseAdjustment: UIAdjustment = {
      complexity,
      animations: {
        enabled: !profile.reducedMotion,
        duration: 300,
        intensity: 'medium',
      },
      typography: {
        scale: 1,
        lineHeight: 1.5,
        letterSpacing: 0,
      },
      layout: {
        density: 'comfortable',
        maxVisibleItems: 5,
        cardElevation: 2,
      },
      colors: {
        contrast: profile.highContrast ? 'high' : 'normal',
        saturation: 1,
        brightness: 1,
      },
    };

    switch (complexity) {
      case 1:
        return {
          ...baseAdjustment,
          animations: {
            enabled: false,
            duration: 0,
            intensity: 'low',
          },
          typography: {
            scale: 1.1,
            lineHeight: 1.8,
            letterSpacing: 0.5,
          },
          layout: {
            density: 'spacious',
            maxVisibleItems: 3,
            cardElevation: 1,
          },
          colors: {
            contrast: 'high',
            saturation: 0.8,
            brightness: 1.05,
          },
        };

      case 2:
        return {
          ...baseAdjustment,
          animations: {
            enabled: !profile.reducedMotion,
            duration: 200,
            intensity: 'low',
          },
          typography: {
            scale: 1,
            lineHeight: 1.6,
            letterSpacing: 0.2,
          },
          layout: {
            density: 'comfortable',
            maxVisibleItems: 5,
            cardElevation: 2,
          },
          colors: {
            contrast: profile.highContrast ? 'high' : 'normal',
            saturation: 0.9,
            brightness: 1,
          },
        };

      case 3:
        return {
          ...baseAdjustment,
          animations: {
            enabled: !profile.reducedMotion,
            duration: 300,
            intensity: 'medium',
          },
          typography: {
            scale: 0.95,
            lineHeight: 1.4,
            letterSpacing: 0,
          },
          layout: {
            density: 'compact',
            maxVisibleItems: 8,
            cardElevation: 3,
          },
          colors: {
            contrast: profile.highContrast ? 'high' : 'normal',
            saturation: 1,
            brightness: 1,
          },
        };

      default:
        return baseAdjustment;
    }
  }

  calculateAdaptiveBreakInterval(
    state: CognitiveState,
    profile: CognitiveProfile,
    patterns: Array<{ type: string; confidence: number }>
  ): number {
    const baseInterval = profile.breakIntervalMinutes;
    let modifier = 1;

    if (state.overloadIndex > 60) {
      modifier -= 0.3;
    }

    if (state.focusScore > 80) {
      modifier += 0.2;
    }

    const deepDiverPattern = patterns.find(p => p.type === 'deep_diver');
    if (deepDiverPattern && deepDiverPattern.confidence > 0.7) {
      modifier += 0.3;
    }

    const frequentSwitcher = patterns.find(p => p.type === 'frequent_switcher');
    if (frequentSwitcher && frequentSwitcher.confidence > 0.6) {
      modifier -= 0.2;
    }

    return Math.max(10, Math.min(60, Math.round(baseInterval * modifier)));
  }

  suggestFocusTechnique(
    state: CognitiveState,
    patterns: Array<{ type: string; confidence: number }>
  ): { name: string; duration: number; description: string } {
    if (patterns.some(p => p.type === 'frequent_switcher' && p.confidence > 0.6)) {
      return {
        name: 'Micro-Pomodoro',
        duration: 15,
        description: 'Ciclos curtos de 15 minutos com 5 minutos de pausa. Ideal para quem alterna frequentemente.',
      };
    }

    if (patterns.some(p => p.type === 'deep_diver' && p.confidence > 0.7)) {
      return {
        name: 'Deep Work Session',
        duration: 50,
        description: 'Sessão prolongada de foco intenso. Reserve 10 minutos de pausa depois.',
      };
    }

    if (state.overloadIndex > 50) {
      return {
        name: 'Pomodoro Suave',
        duration: 20,
        description: 'Sessões mais curtas para recuperação gradual do foco.',
      };
    }

    return {
      name: 'Pomodoro Clássico',
      duration: 25,
      description: 'Técnica tradicional de 25 minutos de foco seguidos de 5 minutos de pausa.',
    };
  }

  getAdaptationHistory(): AdaptationHistory {
    return { ...this.history };
  }

  private isRuleApplicable(rule: AdaptationRule, state: CognitiveState): boolean {
    const timeSinceLastAdjustment = (Date.now() - this.history.lastAdjustmentTime) / 60000;
    
    if (timeSinceLastAdjustment < rule.cooldownMinutes) {
      return false;
    }

    return rule.condition(state, this.history);
  }

  private recordAdjustment(adjustment: ComplexityAdjustment): void {
    this.history.adjustments.push({
      timestamp: Date.now(),
      fromLevel: adjustment.currentLevel,
      toLevel: adjustment.suggestedLevel,
      reason: adjustment.reason,
    });

    if (this.history.adjustments.length > this.maxHistorySize) {
      this.history.adjustments = this.history.adjustments.slice(-this.maxHistorySize);
    }

    this.history.lastAdjustmentTime = Date.now();
  }
}

export const adaptiveEngine = new AdaptiveEngine();
