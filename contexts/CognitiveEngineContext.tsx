import { useEffect, useState, useCallback, useRef } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import { CognitiveState } from '@/types/mindease';
import { useCognitiveProfile } from './CognitiveProfileContext';

const initialState: CognitiveState = {
  focusScore: 85,
  overloadIndex: 15,
  sessionStartTime: Date.now(),
  sessionDurationMinutes: 0,
  taskSwitchCount: 0,
  lastActiveTimestamp: Date.now(),
  isInFocusMode: false,
  shouldSuggestBreak: false,
  currentStreak: 0,
};

export const [CognitiveEngineProvider, useCognitiveEngine] = createContextHook(() => {
  const { profile } = useCognitiveProfile();
  const [state, setState] = useState<CognitiveState>(initialState);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const taskSwitchTimestamps = useRef<number[]>([]);

  useEffect(() => {
    tickRef.current = setInterval(() => {
      setState((prev) => {
        const now = Date.now();
        const sessionMinutes = Math.floor((now - prev.sessionStartTime) / 60000);
        const timeSinceActive = (now - prev.lastActiveTimestamp) / 60000;

        let overloadDelta = 0;
        if (sessionMinutes > 0 && sessionMinutes % profile.breakIntervalMinutes === 0) {
          overloadDelta += 2;
        }
        if (prev.taskSwitchCount > 5) {
          overloadDelta += 1;
        }
        if (timeSinceActive > 2) {
          overloadDelta -= 3;
        }

        const newOverload = Math.max(0, Math.min(100, prev.overloadIndex + overloadDelta));
        const newFocusScore = Math.max(0, Math.min(100, 100 - newOverload * 0.8));
        const shouldBreak = sessionMinutes >= profile.breakIntervalMinutes && !prev.isInFocusMode;

        return {
          ...prev,
          sessionDurationMinutes: sessionMinutes,
          overloadIndex: newOverload,
          focusScore: newFocusScore,
          shouldSuggestBreak: shouldBreak,
        };
      });
    }, 30000);

    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [profile.breakIntervalMinutes]);

  const recordTaskSwitch = useCallback(() => {
    const now = Date.now();
    taskSwitchTimestamps.current.push(now);
    const recentSwitches = taskSwitchTimestamps.current.filter(
      (t) => now - t < 300000
    );
    taskSwitchTimestamps.current = recentSwitches;

    setState((prev) => ({
      ...prev,
      taskSwitchCount: recentSwitches.length,
      lastActiveTimestamp: now,
      overloadIndex: Math.min(100, prev.overloadIndex + recentSwitches.length * 2),
    }));
  }, []);

  const recordActivity = useCallback(() => {
    setState((prev) => ({
      ...prev,
      lastActiveTimestamp: Date.now(),
    }));
  }, []);

  const startFocusMode = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isInFocusMode: true,
      sessionStartTime: Date.now(),
      sessionDurationMinutes: 0,
      shouldSuggestBreak: false,
    }));
  }, []);

  const endFocusMode = useCallback((completedSuccessfully: boolean) => {
    setState((prev) => ({
      ...prev,
      isInFocusMode: false,
      currentStreak: completedSuccessfully ? prev.currentStreak + 1 : prev.currentStreak,
      overloadIndex: Math.max(0, prev.overloadIndex - 15),
      shouldSuggestBreak: false,
    }));
  }, []);

  const dismissBreakSuggestion = useCallback(() => {
    setState((prev) => ({
      ...prev,
      shouldSuggestBreak: false,
    }));
  }, []);

  const takeBreak = useCallback(() => {
    setState((prev) => ({
      ...prev,
      shouldSuggestBreak: false,
      overloadIndex: Math.max(0, prev.overloadIndex - 20),
      focusScore: Math.min(100, prev.focusScore + 15),
      sessionStartTime: Date.now(),
      sessionDurationMinutes: 0,
    }));
  }, []);

  const getOverloadLevel = useCallback((): 'calm' | 'mild' | 'moderate' | 'high' => {
    if (state.overloadIndex < 25) return 'calm';
    if (state.overloadIndex < 50) return 'mild';
    if (state.overloadIndex < 75) return 'moderate';
    return 'high';
  }, [state.overloadIndex]);

  return {
    state,
    recordTaskSwitch,
    recordActivity,
    startFocusMode,
    endFocusMode,
    dismissBreakSuggestion,
    takeBreak,
    getOverloadLevel,
  };
});
