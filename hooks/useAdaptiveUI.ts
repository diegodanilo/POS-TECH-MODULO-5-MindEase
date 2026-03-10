import { useCognitiveEngine } from '@/contexts/CognitiveEngineContext';
import { useCognitiveProfile } from '@/contexts/CognitiveProfileContext';
import { adaptiveEngine } from '@/services/ai/adaptiveEngine';
import { ComplexityAdjustment } from '@/types/ai';
import { CognitiveComplexity } from '@/types/mindease';
import { useCallback, useEffect, useMemo, useState } from 'react';

interface AdaptiveUIConfig {
  complexity: CognitiveComplexity;
  shouldReduceMotion: boolean;
  isHighContrast: boolean;
  maxVisibleItems: number;
  typographyScale: number;
  spacingMultiplier: number;
  animationDuration: number;
  cardElevation: number;
}

interface AdaptiveSuggestion {
  id: string;
  type: 'complexity_change' | 'break_suggested' | 'focus_mode';
  title: string;
  description: string;
  action: () => void;
  dismiss: () => void;
}

export function useAdaptiveUI() {
  const { profile, setComplexity } = useCognitiveProfile();
  const { state, takeBreak, startFocusMode } = useCognitiveEngine();
  const [pendingAdjustment, setPendingAdjustment] = useState<ComplexityAdjustment | null>(null);
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<string>>(new Set());

  const uiConfig = useMemo<AdaptiveUIConfig>(() => {
    const adjustment = adaptiveEngine.generateUIAdjustment(profile.complexity, profile);

    return {
      complexity: profile.complexity,
      shouldReduceMotion: profile.reducedMotion || !adjustment.animations.enabled,
      isHighContrast: adjustment.colors.contrast === 'high',
      maxVisibleItems: adjustment.layout.maxVisibleItems,
      typographyScale: adjustment.typography.scale,
      spacingMultiplier: adjustment.layout.density === 'spacious' ? 1.5 : adjustment.layout.density === 'compact' ? 0.8 : 1,
      animationDuration: adjustment.animations.duration,
      cardElevation: adjustment.layout.cardElevation,
    };
  }, [profile]);

  const adaptiveStyles = useMemo(() => ({
    container: {
      padding: 16 * uiConfig.spacingMultiplier,
    },
    card: {
      padding: 16 * uiConfig.spacingMultiplier,
      marginVertical: 8 * uiConfig.spacingMultiplier,
      elevation: uiConfig.cardElevation,
      shadowOpacity: uiConfig.cardElevation * 0.05,
    },
    text: {
      fontSize: 16 * uiConfig.typographyScale,
      lineHeight: 24 * uiConfig.typographyScale * 1.2,
    },
    heading: {
      fontSize: 24 * uiConfig.typographyScale,
      lineHeight: 32 * uiConfig.typographyScale,
    },
    animation: {
      duration: uiConfig.animationDuration,
      useNativeDriver: true,
    },
  }), [uiConfig]);

  const checkForAdaptation = useCallback(() => {
    const adjustment = adaptiveEngine.evaluateAdaptation(state, profile);

    if (adjustment && adjustment.confidence > 0.7) {
      const suggestionId = `adj_${adjustment.suggestedLevel}_${Date.now()}`;

      if (!dismissedSuggestions.has(suggestionId)) {
        setPendingAdjustment(adjustment);
        return adjustment;
      }
    }

    return null;
  }, [state, profile, dismissedSuggestions]);

  useEffect(() => {
    const interval = setInterval(() => {
      checkForAdaptation();
    }, 30000);

    return () => clearInterval(interval);
  }, [checkForAdaptation]);

  const applyComplexityChange = useCallback((level: CognitiveComplexity) => {
    setComplexity(level);
    setPendingAdjustment(null);
  }, [setComplexity]);

  const dismissAdjustment = useCallback(() => {
    if (pendingAdjustment) {
      const id = `adj_${pendingAdjustment.suggestedLevel}_${Date.now()}`;
      setDismissedSuggestions(prev => new Set(prev).add(id));
      setPendingAdjustment(null);
    }
  }, [pendingAdjustment]);

  const suggestions = useMemo<AdaptiveSuggestion[]>(() => {
    const items: AdaptiveSuggestion[] = [];

    if (pendingAdjustment && pendingAdjustment.confidence > 0.7) {
      items.push({
        id: `complexity_${pendingAdjustment.suggestedLevel}`,
        type: 'complexity_change',
        title: pendingAdjustment.suggestedLevel < profile.complexity
          ? 'Simplificar Interface'
          : 'Aumentar Complexidade',
        description: pendingAdjustment.reason,
        action: () => applyComplexityChange(pendingAdjustment.suggestedLevel),
        dismiss: dismissAdjustment,
      });
    }

    if (state.shouldSuggestBreak) {
      items.push({
        id: 'break_suggested',
        type: 'break_suggested',
        title: 'Hora de uma Pausa',
        description: 'Você está em foco há um tempo. Uma pausa curta pode ajudar a manter a produtividade.',
        action: takeBreak,
        dismiss: () => {},
      });
    }

    if (state.focusScore > 80 && !state.isInFocusMode) {
      items.push({
        id: 'focus_mode',
        type: 'focus_mode',
        title: 'Modo Foco Recomendado',
        description: 'Seu score de foco está alto. Aproveite para iniciar uma sessão de foco profundo.',
        action: startFocusMode,
        dismiss: () => {},
      });
    }

    return items.filter(s => !dismissedSuggestions.has(s.id));
  }, [
    pendingAdjustment,
    profile.complexity,
    state.shouldSuggestBreak,
    state.focusScore,
    state.isInFocusMode,
    applyComplexityChange,
    dismissAdjustment,
    takeBreak,
    startFocusMode,
    dismissedSuggestions,
  ]);

  const getVisibleItems = useCallback(<T>(items: T[]): T[] => {
    return items.slice(0, uiConfig.maxVisibleItems);
  }, [uiConfig.maxVisibleItems]);

  const shouldAnimate = useCallback((): boolean => {
    return !uiConfig.shouldReduceMotion;
  }, [uiConfig.shouldReduceMotion]);

  const getTypographyStyle = useCallback((baseSize: number) => ({
    fontSize: baseSize * uiConfig.typographyScale,
    lineHeight: baseSize * uiConfig.typographyScale * 1.5,
  }), [uiConfig.typographyScale]);

  return {
    config: uiConfig,
    styles: adaptiveStyles,
    suggestions,
    pendingAdjustment,
    applyComplexityChange,
    dismissAdjustment,
    getVisibleItems,
    shouldAnimate,
    getTypographyStyle,
    checkForAdaptation,
  };
}
