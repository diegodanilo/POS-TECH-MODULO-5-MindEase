import { useCognitiveEngine } from '@/contexts/CognitiveEngineContext';
import { useCognitiveProfile } from '@/contexts/CognitiveProfileContext';
import { useTasks } from '@/contexts/TaskContext';
import { adaptiveEngine } from '@/services/ai/adaptiveEngine';
import { cognitiveAnalytics } from '@/services/ai/cognitiveAnalytics';
import { patternRecognition } from '@/services/ai/patternRecognition';
import {
    BehavioralPattern,
    CognitiveMetricsSnapshot,
    ComplexityAdjustment,
    DailyCognitiveReport,
    OverloadPrediction,
} from '@/types/ai';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';

interface AIInsightsState {
  metrics: CognitiveMetricsSnapshot | null;
  patterns: BehavioralPattern[];
  prediction: OverloadPrediction | null;
  adjustment: ComplexityAdjustment | null;
  isAnalyzing: boolean;
}

export function useAIInsights() {
  const { state } = useCognitiveEngine();
  const { profile } = useCognitiveProfile();
  const { tasks } = useTasks();
  const queryClient = useQueryClient();

  const [aiState, setAiState] = useState<AIInsightsState>({
    metrics: null,
    patterns: [],
    prediction: null,
    adjustment: null,
    isAnalyzing: false,
  });

  const analysisIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const metricsQuery = useQuery({
    queryKey: ['ai-metrics', state.sessionStartTime],
    queryFn: () => cognitiveAnalytics.generateMetricsSnapshot(state),
    refetchInterval: 30000,
    staleTime: 15000,
  });

  const patternsMutation = useMutation({
    mutationFn: async () => {
      setAiState(prev => ({ ...prev, isAnalyzing: true }));
      const detected = patternRecognition.analyzePatterns(state, tasks, 7);
      return detected;
    },
    onSuccess: (patterns) => {
      setAiState(prev => ({ ...prev, patterns, isAnalyzing: false }));
      queryClient.setQueryData(['behavioral-patterns'], patterns);
    },
    onError: () => {
      setAiState(prev => ({ ...prev, isAnalyzing: false }));
    },
  });

  const predictionMutation = useMutation({
    mutationFn: async () => {
      return adaptiveEngine.predictOverload(state);
    },
    onSuccess: (prediction) => {
      setAiState(prev => ({ ...prev, prediction }));
    },
  });

  const adaptationMutation = useMutation({
    mutationFn: async () => {
      return adaptiveEngine.evaluateAdaptation(state, profile);
    },
    onSuccess: (adjustment) => {
      setAiState(prev => ({ ...prev, adjustment }));
    },
  });

  useEffect(() => {
    if (metricsQuery.data) {
      setAiState(prev => ({ ...prev, metrics: metricsQuery.data || null }));
    }
  }, [metricsQuery.data]);

  const runAnalysis = useCallback(() => {
    patternsMutation.mutate();
    predictionMutation.mutate();
    adaptationMutation.mutate();
  }, [patternsMutation, predictionMutation, adaptationMutation]);

  useEffect(() => {
    analysisIntervalRef.current = setInterval(runAnalysis, 60000);

    return () => {
      if (analysisIntervalRef.current) {
        clearInterval(analysisIntervalRef.current);
      }
    };
  }, [runAnalysis]);

  const generateDailyReport = useCallback(
    (date: string): DailyCognitiveReport => {
      return patternRecognition.generateDailyReport(date, state, tasks);
    },
    [state, tasks]
  );

  const getOptimalSessionLength = useCallback((): number => {
    const primaryPattern = aiState.patterns[0] || null;
    return patternRecognition.predictOptimalSessionLength(primaryPattern);
  }, [aiState.patterns]);

  const getBestFocusTime = useCallback(() => {
    return patternRecognition.predictBestFocusTime();
  }, []);

  const getAdaptiveBreakInterval = useCallback((): number => {
    const patternsForEngine = aiState.patterns.map(p => ({
      type: p.patternType,
      confidence: p.confidence,
    }));
    return adaptiveEngine.calculateAdaptiveBreakInterval(
      state,
      profile,
      patternsForEngine
    );
  }, [aiState.patterns, state, profile]);

  const getSuggestedFocusTechnique = useCallback(() => {
    const patternsForEngine = aiState.patterns.map(p => ({
      type: p.patternType,
      confidence: p.confidence,
    }));
    return adaptiveEngine.suggestFocusTechnique(state, patternsForEngine);
  }, [aiState.patterns, state]);

  const applyAdaptiveAdjustment = useCallback(
    (adjustment: ComplexityAdjustment, onApply: (level: number) => void) => {
      if (adjustment.confidence > 0.7) {
        onApply(adjustment.suggestedLevel);
        return true;
      }
      return false;
    },
    []
  );

  const recordInteraction = useCallback(
    (type: string, metadata?: Record<string, unknown>) => {
      cognitiveAnalytics.recordEvent({
        type: type as any,
        timestamp: Date.now(),
        metadata,
      });
      patternRecognition.recordEvent({
        id: `evt_${Date.now()}`,
        type: type as any,
        timestamp: Date.now(),
        metadata,
      });
    },
    []
  );

  return {
    metrics: aiState.metrics,
    patterns: aiState.patterns,
    prediction: aiState.prediction,
    adjustment: aiState.adjustment,
    isAnalyzing: aiState.isAnalyzing,
    isLoading:
      patternsMutation.isPending ||
      predictionMutation.isPending ||
      adaptationMutation.isPending,
    generateDailyReport,
    getOptimalSessionLength,
    getBestFocusTime,
    getAdaptiveBreakInterval,
    getSuggestedFocusTechnique,
    applyAdaptiveAdjustment,
    recordInteraction,
    refetchPatterns: () => patternsMutation.mutate(),
    refetchPrediction: () => predictionMutation.mutate(),
  };
}
