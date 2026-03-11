import { adaptiveEngine } from '@/services/ai/adaptiveEngine';
import { generateCoachingMessage, generatePersonalizedInsights } from '@/services/ai/aiInsights';
import { cognitiveAnalytics } from '@/services/ai/cognitiveAnalytics';
import { patternRecognition } from '@/services/ai/patternRecognition';
import {
  AIConfiguration,
  BehavioralPattern,
  CognitiveMetricsSnapshot,
  ComplexityAdjustment,
  DailyCognitiveReport,
  OverloadPrediction,
} from '@/types/ai';
import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useCognitiveEngine } from './CognitiveEngineContext';
import { useCognitiveProfile } from './CognitiveProfileContext';

const AI_CONFIG_KEY = 'mindease_ai_config';

const defaultConfig: AIConfiguration = {
  enabled: true,
  privacyMode: 'hybrid',
  analysisFrequency: 'periodic',
  retentionDays: 30,
  anonymizationEnabled: true,
};

interface AIState {
  metrics: CognitiveMetricsSnapshot | null;
  patterns: BehavioralPattern[];
  prediction: OverloadPrediction | null;
  adjustment: ComplexityAdjustment | null;
  config: AIConfiguration;
  isInitialized: boolean;
}

export const [AIProvider, useAI] = createContextHook(() => {
  const { state: cognitiveState } = useCognitiveEngine();
  const { profile } = useCognitiveProfile();

  const [aiState, setAiState] = useState<AIState>({
    metrics: null,
    patterns: [],
    prediction: null,
    adjustment: null,
    config: defaultConfig,
    isInitialized: false,
  });

  const configQuery = useQuery({
    queryKey: ['ai-config'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(AI_CONFIG_KEY);
      if (stored) {
        return { ...defaultConfig, ...JSON.parse(stored) } as AIConfiguration;
      }
      return defaultConfig;
    },
  });

  useEffect(() => {
    if (configQuery.data) {
      setAiState(prev => ({ ...prev, config: configQuery.data, isInitialized: true }));
    }
  }, [configQuery.data]);

  const metricsQuery = useQuery({
    queryKey: ['ai-metrics', cognitiveState.sessionStartTime],
    queryFn: () => cognitiveAnalytics.generateMetricsSnapshot(cognitiveState),
    refetchInterval: aiState.config.enabled ? 30000 : false,
    enabled: aiState.config.enabled && aiState.isInitialized,
  });

  useEffect(() => {
    if (metricsQuery.data) {
      setAiState(prev => ({ ...prev, metrics: metricsQuery.data }));
    }
  }, [metricsQuery.data]);

  const patternsMutation = useMutation({
    mutationFn: async () => {
      if (!aiState.config.enabled) return [];

      const detected = patternRecognition.analyzePatterns(
        cognitiveState,
        [],
        aiState.config.retentionDays
      );
      return detected;
    },
    onSuccess: (patterns) => {
      setAiState(prev => ({ ...prev, patterns }));
    },
  });

  const predictionMutation = useMutation({
    mutationFn: async () => {
      if (!aiState.config.enabled) return null;
      return adaptiveEngine.predictOverload(cognitiveState);
    },
    onSuccess: (prediction) => {
      setAiState(prev => ({ ...prev, prediction }));
    },
  });

  const adaptationMutation = useMutation({
    mutationFn: async () => {
      if (!aiState.config.enabled) return null;
      return adaptiveEngine.evaluateAdaptation(cognitiveState, profile);
    },
    onSuccess: (adjustment) => {
      setAiState(prev => ({ ...prev, adjustment }));
    },
  });

  const runAnalysis = useCallback(() => {
    patternsMutation.mutate();
    predictionMutation.mutate();
    adaptationMutation.mutate();
  }, [patternsMutation, predictionMutation, adaptationMutation]);

  useEffect(() => {
    if (!aiState.config.enabled || !aiState.isInitialized) return;

    const interval = setInterval(runAnalysis, aiState.config.analysisFrequency === 'realtime' ? 15000 : 60000);

    return () => clearInterval(interval);
  }, [aiState.config.enabled, aiState.config.analysisFrequency, aiState.isInitialized, runAnalysis]);

  const recordEvent = useCallback(
    (type: string, metadata?: Record<string, unknown>) => {
      if (!aiState.config.enabled) return;

      const event = {
        id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: type as any,
        timestamp: Date.now(),
        metadata: aiState.config.anonymizationEnabled
          ? anonymizeMetadata(metadata)
          : metadata,
      };

      cognitiveAnalytics.recordEvent({
        type: type as any,
        timestamp: Date.now(),
        metadata: event.metadata,
      });
      patternRecognition.recordEvent(event);
    },
    [aiState.config.enabled, aiState.config.anonymizationEnabled]
  );

  const generateInsightsMutation = useMutation({
    mutationFn: async (report: DailyCognitiveReport) => {
      if (aiState.config.privacyMode === 'local_only') {
        return [];
      }
      return generatePersonalizedInsights({
        report,
        userConditions: profile.conditions,
      });
    },
  });

  const generateCoachingMutation = useMutation({
    mutationFn: async (pattern: BehavioralPattern) => {
      if (aiState.config.privacyMode === 'local_only' || !aiState.metrics) {
        return null;
      }
      return generateCoachingMessage(pattern, aiState.metrics);
    },
  });

  const updateConfig = useCallback(async (updates: Partial<AIConfiguration>) => {
    const newConfig = { ...aiState.config, ...updates };
    await AsyncStorage.setItem(AI_CONFIG_KEY, JSON.stringify(newConfig));
    setAiState(prev => ({ ...prev, config: newConfig }));
  }, [aiState.config]);

  const exportData = useCallback(() => {
    return {
      events: cognitiveAnalytics.exportData(),
      patterns: aiState.patterns,
      config: aiState.config,
      exportedAt: Date.now(),
    };
  }, [aiState.patterns, aiState.config]);

  const clearData = useCallback(async () => {
    cognitiveAnalytics.clearHistory();
    patternRecognition.clearData();
    setAiState(prev => ({
      ...prev,
      metrics: null,
      patterns: [],
      prediction: null,
      adjustment: null,
    }));
  }, []);

  const refetchPatterns = useCallback(() => patternsMutation.mutate(), [patternsMutation]);
  const refetchPrediction = useCallback(() => predictionMutation.mutate(), [predictionMutation]);

  return useMemo(() => ({
    metrics: aiState.metrics,
    patterns: aiState.patterns,
    prediction: aiState.prediction,
    adjustment: aiState.adjustment,
    config: aiState.config,
    isInitialized: aiState.isInitialized,
    isLoading:
      patternsMutation.isPending ||
      predictionMutation.isPending ||
      adaptationMutation.isPending,
    recordEvent,
    generateInsights: generateInsightsMutation.mutateAsync,
    generateCoaching: generateCoachingMutation.mutateAsync,
    updateConfig,
    exportData,
    clearData,
    refetchPatterns,
    refetchPrediction,
  }), [
    aiState.metrics,
    aiState.patterns,
    aiState.prediction,
    aiState.adjustment,
    aiState.config,
    aiState.isInitialized,
    patternsMutation.isPending,
    predictionMutation.isPending,
    adaptationMutation.isPending,
    recordEvent,
    generateInsightsMutation.mutateAsync,
    generateCoachingMutation.mutateAsync,
    updateConfig,
    exportData,
    clearData,
    refetchPatterns,
    refetchPrediction,
  ]);
});

function anonymizeMetadata(metadata?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!metadata) return undefined;

  const sensitiveKeys = ['name', 'email', 'title', 'description'];
  const anonymized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(metadata)) {
    if (sensitiveKeys.includes(key.toLowerCase())) {
      anonymized[key] = typeof value === 'string' ? '[REDACTED]' : value;
    } else {
      anonymized[key] = value;
    }
  }

  return anonymized;
}