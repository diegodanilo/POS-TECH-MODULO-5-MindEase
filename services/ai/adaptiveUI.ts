import { CognitiveComplexity } from '@/types/mindease';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing } from 'react-native';
import { cognitivePredictor } from './tensorflowModel';

interface UIAdaptation {
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

interface CognitiveStateSnapshot {
  overloadIndex: number;
  focusScore: number;
  stressLevel: number;
  heartRate?: number;
  timestamp: number;
}

interface AdaptationTrigger {
  type: 'overload' | 'stress' | 'focus_drop' | 'fatigue' | 'recovery';
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: number;
  autoApplied: boolean;
}

const ADAPTATION_KEY = 'mindease_ui_adaptation';
const TRIGGER_HISTORY_KEY = 'mindease_adaptation_triggers';

export class AdaptiveUIService {
  private currentAdaptation: UIAdaptation = this.getDefaultAdaptation();
  private triggerHistory: AdaptationTrigger[] = [];
  private lastAdaptationTime = 0;
  private readonly minAdaptationInterval = 30000;
  private listeners: Set<(adaptation: UIAdaptation) => void> = new Set();

  async initialize(): Promise<void> {
    await this.loadStoredAdaptation();
    await cognitivePredictor.initialize();
  }

  private getDefaultAdaptation(): UIAdaptation {
    return {
      complexity: 2,
      animations: {
        enabled: true,
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
        contrast: 'normal',
        saturation: 1,
        brightness: 1,
      },
    };
  }

  private async loadStoredAdaptation(): Promise<void> {
    try {
      const [adaptationData, triggerData] = await Promise.all([
        AsyncStorage.getItem(ADAPTATION_KEY),
        AsyncStorage.getItem(TRIGGER_HISTORY_KEY),
      ]);

      if (adaptationData) {
        this.currentAdaptation = { ...this.getDefaultAdaptation(), ...JSON.parse(adaptationData) };
      }

      if (triggerData) {
        this.triggerHistory = JSON.parse(triggerData);
      }
    } catch (error) {
      console.warn('Failed to load adaptation data:', error);
    }
  }

  private async saveAdaptation(): Promise<void> {
    try {
      await AsyncStorage.setItem(ADAPTATION_KEY, JSON.stringify(this.currentAdaptation));
      await AsyncStorage.setItem(TRIGGER_HISTORY_KEY, JSON.stringify(this.triggerHistory.slice(-50)));
    } catch (error) {
      console.warn('Failed to save adaptation data:', error);
    }
  }

  evaluateAndAdapt(state: CognitiveStateSnapshot): UIAdaptation | null {
    const now = Date.now();
    
    if (now - this.lastAdaptationTime < this.minAdaptationInterval) {
      return null;
    }

    const trigger = this.detectTrigger(state);
    if (!trigger) return null;

    this.triggerHistory.push(trigger);
    
    const newAdaptation = this.calculateAdaptation(state, trigger);
    
    if (this.shouldApplyAdaptation(newAdaptation)) {
      this.currentAdaptation = newAdaptation;
      this.lastAdaptationTime = now;
      this.notifyListeners();
      void this.saveAdaptation();
      return newAdaptation;
    }

    return null;
  }

  private detectTrigger(state: CognitiveStateSnapshot): AdaptationTrigger | null {
    // Critical overload
    if (state.overloadIndex >= 80) {
      return {
        type: 'overload',
        severity: 'critical',
        timestamp: Date.now(),
        autoApplied: true,
      };
    }

    // High overload
    if (state.overloadIndex >= 60) {
      return {
        type: 'overload',
        severity: 'high',
        timestamp: Date.now(),
        autoApplied: true,
      };
    }

    // Stress from wearable
    if (state.stressLevel >= 70) {
      return {
        type: 'stress',
        severity: state.stressLevel >= 85 ? 'critical' : 'high',
        timestamp: Date.now(),
        autoApplied: true,
      };
    }

    // Focus drop
    if (state.focusScore < 40 && state.overloadIndex > 50) {
      return {
        type: 'focus_drop',
        severity: 'medium',
        timestamp: Date.now(),
        autoApplied: true,
      };
    }

    // Recovery detected
    if (state.overloadIndex < 30 && state.focusScore > 70) {
      const recentHighStress = this.triggerHistory.some(
        t => t.type === 'overload' && t.severity === 'critical' && Date.now() - t.timestamp < 600000
      );
      
      if (recentHighStress) {
        return {
          type: 'recovery',
          severity: 'low',
          timestamp: Date.now(),
          autoApplied: true,
        };
      }
    }

    return null;
  }

  private calculateAdaptation(state: CognitiveStateSnapshot, trigger: AdaptationTrigger): UIAdaptation {
    const base = this.getDefaultAdaptation();

    switch (trigger.type) {
      case 'overload':
        if (trigger.severity === 'critical') {
          return {
            complexity: 1,
            animations: { enabled: false, duration: 0, intensity: 'low' },
            typography: { scale: 1.15, lineHeight: 1.8, letterSpacing: 0.5 },
            layout: { density: 'spacious', maxVisibleItems: 3, cardElevation: 1 },
            colors: { contrast: 'high', saturation: 0.7, brightness: 1.05 },
          };
        }
        return {
          complexity: 1,
          animations: { enabled: false, duration: 150, intensity: 'low' },
          typography: { scale: 1.1, lineHeight: 1.7, letterSpacing: 0.3 },
          layout: { density: 'spacious', maxVisibleItems: 4, cardElevation: 1 },
          colors: { contrast: 'high', saturation: 0.8, brightness: 1.02 },
        };

      case 'stress':
        return {
          complexity: 1,
          animations: { enabled: false, duration: 200, intensity: 'low' },
          typography: { scale: 1.1, lineHeight: 1.6, letterSpacing: 0.2 },
          layout: { density: 'comfortable', maxVisibleItems: 4, cardElevation: 1 },
          colors: { contrast: 'normal', saturation: 0.75, brightness: 1 },
        };

      case 'focus_drop':
        return {
          complexity: 1,
          animations: { enabled: false, duration: 100, intensity: 'low' },
          typography: { scale: 1.05, lineHeight: 1.6, letterSpacing: 0.1 },
          layout: { density: 'comfortable', maxVisibleItems: 4, cardElevation: 1 },
          colors: { contrast: 'normal', saturation: 0.85, brightness: 1 },
        };

      case 'recovery':
        return {
          complexity: 2,
          animations: { enabled: true, duration: 250, intensity: 'low' },
          typography: { scale: 1, lineHeight: 1.5, letterSpacing: 0 },
          layout: { density: 'comfortable', maxVisibleItems: 5, cardElevation: 2 },
          colors: { contrast: 'normal', saturation: 0.9, brightness: 1 },
        };

      default:
        return base;
    }
  }

  private shouldApplyAdaptation(newAdaptation: UIAdaptation): boolean {
    const current = this.currentAdaptation;
    
    // Always apply if complexity changes significantly
    if (Math.abs(newAdaptation.complexity - current.complexity) >= 1) {
      return true;
    }

    // Apply if animations disabled (stress reduction)
    if (!newAdaptation.animations.enabled && current.animations.enabled) {
      return true;
    }

    // Apply if typography scale changes significantly
    if (Math.abs(newAdaptation.typography.scale - current.typography.scale) > 0.1) {
      return true;
    }

    return false;
  }

  getCurrentAdaptation(): UIAdaptation {
    return { ...this.currentAdaptation };
  }

  setManualComplexity(level: CognitiveComplexity): void {
    this.currentAdaptation = {
      ...this.currentAdaptation,
      complexity: level,
    };
    this.notifyListeners();
    void this.saveAdaptation();
  }

  subscribe(listener: (adaptation: UIAdaptation) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.currentAdaptation));
  }

  getTriggerHistory(): AdaptationTrigger[] {
    return [...this.triggerHistory];
  }

  clearHistory(): void {
    this.triggerHistory = [];
    void AsyncStorage.removeItem(TRIGGER_HISTORY_KEY);
  }
}

export const adaptiveUIService = new AdaptiveUIService();

// React Hook for using adaptive UI
export function useAdaptiveUI() {
  const [adaptation, setAdaptation] = useState<UIAdaptation>(adaptiveUIService.getCurrentAdaptation());
  const animatedValues = useRef({
    scale: new Animated.Value(1),
    opacity: new Animated.Value(1),
    elevation: new Animated.Value(2),
  }).current;

  useEffect(() => {
    const unsubscribe = adaptiveUIService.subscribe((newAdaptation) => {
      setAdaptation(newAdaptation);
      
      // Animate to new values
      Animated.parallel([
        Animated.timing(animatedValues.scale, {
          toValue: newAdaptation.typography.scale,
          duration: newAdaptation.animations.duration,
          easing: Easing.out(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(animatedValues.opacity, {
          toValue: newAdaptation.colors.brightness,
          duration: newAdaptation.animations.duration,
          easing: Easing.out(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(animatedValues.elevation, {
          toValue: newAdaptation.layout.cardElevation,
          duration: newAdaptation.animations.duration,
          easing: Easing.out(Easing.ease),
          useNativeDriver: false,
        }),
      ]).start();
    });

    return unsubscribe;
  }, [animatedValues.elevation, animatedValues.opacity, animatedValues.scale]);

  const setManualComplexity = useCallback((level: CognitiveComplexity) => {
    adaptiveUIService.setManualComplexity(level);
  }, []);

  return {
    adaptation,
    animatedValues,
    setManualComplexity,
  };
}
