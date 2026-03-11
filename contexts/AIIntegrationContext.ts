import { adaptiveUIService } from '@/services/ai/adaptiveUI';
import { conversationalAgent } from '@/services/ai/conversationalAgent';
import { focusPrediction } from '@/services/ai/focusPrediction';
import { habitLearning } from '@/services/ai/habitLearning';
import { kanbanOptimizer } from '@/services/ai/kanbanOptimizer';
import { sentimentAnalyzer } from '@/services/ai/sentimentAnalysis';
import { cognitivePredictor } from '@/services/ai/tensorflowModel';
import { voiceRecognition } from '@/services/ai/voiceRecognition';
import { wearableService } from '@/services/ai/wearableIntegration';
import createContextHook from '@nkzw/create-context-hook';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useCognitiveEngine } from './CognitiveEngineContext';
import { useCognitiveProfile } from './CognitiveProfileContext';
import { useTasks } from './TaskContext';

interface AIIntegrationState {
  isInitialized: boolean;
  mlReady: boolean;
  wearableConnected: boolean;
  lastAnalysis: number;
}

export const [AIIntegrationProvider, useAIIntegration] = createContextHook(() => {
  const { state: cognitiveState, takeBreak } = useCognitiveEngine();
  const { profile } = useCognitiveProfile();
  const { tasks, addTask } = useTasks();
  
  const stateRef = useRef<AIIntegrationState>({
    isInitialized: false,
    mlReady: false,
    wearableConnected: false,
    lastAnalysis: 0,
  });

  // Initialize all AI services
  useEffect(() => {
    const initialize = async () => {
      try {
        await Promise.all([
          cognitivePredictor.initialize(),
          wearableService.initialize(),
          habitLearning.initialize(),
          focusPrediction.initialize(),
          adaptiveUIService.initialize(),
        ]);

        await conversationalAgent.initialize({
          userName: profile.name,
          currentStressLevel: cognitiveState.overloadIndex,
          currentFocusScore: cognitiveState.focusScore,
          pendingTasksCount: tasks.filter(t => !t.completedAt).length,
          lastBreakTime: Date.now() - cognitiveState.sessionDurationMinutes * 60000,
          todaysFocusSessions: 0,
          cognitiveProfile: {
            complexity: profile.complexity,
            conditions: profile.conditions,
          },
        });

        stateRef.current = {
          isInitialized: true,
          mlReady: cognitivePredictor.getModelStatus().isReady,
          wearableConnected: wearableService.isWearableConnected(),
          lastAnalysis: Date.now(),
        };

        console.log('✅ AI Integration initialized successfully');
      } catch (error) {
        console.error('❌ Failed to initialize AI services:', error);
      }
    };

    void initialize();
  }, [profile.complexity, profile.conditions, profile.name, cognitiveState.overloadIndex, cognitiveState.sessionDurationMinutes, cognitiveState.focusScore, tasks]);

  const performContinuousAnalysis = useCallback(() => {
    const now = Date.now();
    stateRef.current.lastAnalysis = now;

    // 1. ML Prediction
    cognitivePredictor.predict({
      sessionDurationMinutes: cognitiveState.sessionDurationMinutes,
      taskSwitchCount: cognitiveState.taskSwitchCount,
      focusScore: cognitiveState.focusScore,
      interruptionCount: 0,
      timeOfDay: new Date().getHours(),
      dayOfWeek: new Date().getDay(),
      previousOverloadIndex: cognitiveState.overloadIndex,
      avgTaskDuration: 25,
    }).then(prediction => {
      console.log('🧠 ML Prediction:', prediction);
    }).catch(console.error);

    // 2. Adaptive UI Evaluation
    adaptiveUIService.evaluateAndAdapt({
      overloadIndex: cognitiveState.overloadIndex,
      focusScore: cognitiveState.focusScore,
      stressLevel: wearableService.analyzeCognitiveState().stressLevel.score,
      timestamp: now,
    });

    // 3. Record habit data
    habitLearning.recordInteraction('app_usage', {
      overloadIndex: cognitiveState.overloadIndex,
      focusScore: cognitiveState.focusScore,
      taskCount: tasks.length,
    });

    // 4. Kanban optimization check
    const pendingTasks = tasks.filter(t => !t.completedAt);
    if (pendingTasks.length > 0) {
      const optimization = kanbanOptimizer.optimizeKanban(pendingTasks, {
        overloadIndex: cognitiveState.overloadIndex,
        focusScore: cognitiveState.focusScore,
        timeOfDay: new Date().getHours(),
      });
      console.log('📋 Kanban optimized:', optimization.rationale);
    }
  }, [cognitiveState, tasks]);

  // Continuous AI analysis loop
  useEffect(() => {
    if (!stateRef.current.isInitialized) return;

    const interval = setInterval(() => {
      performContinuousAnalysis();
    }, 30000);

    return () => clearInterval(interval);
  }, [performContinuousAnalysis]);

  // Voice command handler
  const startVoiceCommand = useCallback(async (
    onResult: (result: { type: string; data?: unknown }) => void,
    onError: (error: Error) => void
  ) => {
    await voiceRecognition.startListening(
      (command) => {
        console.log('🎤 Voice command:', command);
        
        if (command.type === 'create_task' && command.data) {
          const taskData = command.data as { title: string; description?: string; estimatedMinutes?: number; cognitiveLoad?: 'low' | 'medium' | 'high' };
          addTask({
            title: taskData.title,
            description: taskData.description || '',
            cognitiveLoad: taskData.cognitiveLoad || 'medium',
            status: 'pending',
            estimatedMinutes: taskData.estimatedMinutes || 25,
            tags: [],
          });
        }

        onResult({ type: command.type, data: command.data });
      },
      onError
    );
  }, [addTask]);

  // Chat with AI Agent
  const chatWithAgent = useCallback(async (message: string) => {
    conversationalAgent.updateContext({
      currentStressLevel: cognitiveState.overloadIndex,
      currentFocusScore: cognitiveState.focusScore,
      pendingTasksCount: tasks.filter(t => !t.completedAt).length,
    });

    const response = await conversationalAgent.processMessage(message);
    
    // Execute actions if any
    if (response.actions) {
      for (const action of response.actions) {
        switch (action.type) {
          case 'take_break':
            takeBreak();
            break;
          case 'adjust_complexity':
            // Handle complexity adjustment
            break;
          case 'start_focus':
            // Navigate to focus mode
            break;
        }
      }
    }

    return response;
  }, [cognitiveState, tasks, takeBreak]);

  // Analyze task sentiment
  const analyzeTaskSentiment = useCallback((title: string, description?: string) => {
    return sentimentAnalyzer.analyzeTask(title, description);
  }, []);

  // Get focus prediction
  const getFocusPrediction = useCallback(() => {
    return focusPrediction.predictOptimalFocusTime();
  }, []);

  // Get wearable data
  const getWearableData = useCallback(() => {
    return wearableService.analyzeCognitiveState();
  }, []);

  // Optimize kanban
  const optimizeKanban = useCallback(() => {
    const pendingTasks = tasks.filter(t => !t.completedAt);
    return kanbanOptimizer.optimizeKanban(pendingTasks, {
      overloadIndex: cognitiveState.overloadIndex,
      focusScore: cognitiveState.focusScore,
      timeOfDay: new Date().getHours(),
    });
  }, [tasks, cognitiveState]);

  // Get habit insights
  const getHabitInsights = useCallback(() => {
    return {
      prediction: habitLearning.predictForDate(),
      schedule: habitLearning.generateWeeklySchedule(),
      patterns: habitLearning.getPatterns(),
    };
  }, []);

  return useMemo(() => ({
    state: stateRef.current,
    startVoiceCommand,
    chatWithAgent,
    analyzeTaskSentiment,
    getFocusPrediction,
    getWearableData,
    optimizeKanban,
    getHabitInsights,
  }), [startVoiceCommand, chatWithAgent, analyzeTaskSentiment, getFocusPrediction, getWearableData, optimizeKanban, getHabitInsights]);
});