import Colors from '@/constants/colors';
import { useCognitiveProfile } from '@/contexts/CognitiveProfileContext';
import * as Haptics from 'expo-haptics';
import { Pause, Play, RotateCcw, Trophy } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

interface FocusTimerProps {
  onStart: () => void;
  onComplete: (success: boolean) => void;
}

export default function FocusTimer({ onStart, onComplete }: FocusTimerProps) {
  const { profile, tokens } = useCognitiveProfile();
  const totalSeconds = profile.focusGoalMinutes * 60;
  const [secondsLeft, setSecondsLeft] = useState(totalSeconds);
  const [isRunning, setIsRunning] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setSecondsLeft(totalSeconds);
    setIsRunning(false);
    setIsCompleted(false);
    progressAnim.setValue(0);
  }, [totalSeconds]);

  useEffect(() => {
    if (isRunning) {
      tickRef.current = setInterval(() => {
        setSecondsLeft((prev) => {
          if (prev <= 1) {
            setIsRunning(false);
            setIsCompleted(true);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onComplete(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
    }
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [isRunning, onComplete]);

  useEffect(() => {
    const elapsed = totalSeconds - secondsLeft;
    const progress = totalSeconds > 0 ? elapsed / totalSeconds : 0;
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [secondsLeft, totalSeconds]);

  useEffect(() => {
    if (isRunning) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.03, duration: 2000, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isRunning]);

  const toggleTimer = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!isRunning && secondsLeft === totalSeconds) {
      onStart();
    }
    setIsRunning(!isRunning);
  };

  const resetTimer = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsRunning(false);
    setIsCompleted(false);
    setSecondsLeft(totalSeconds);
    progressAnim.setValue(0);
  };

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const timeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  const progressPercent = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.container} testID="focus-timer">
      <Animated.View
        style={[
          styles.timerCircle,
          {
            borderRadius: tokens.borderRadius * 4,
            transform: [{ scale: pulseAnim }],
          },
        ]}
      >
        <View style={styles.progressRing}>
          <Animated.View
            style={[
              styles.progressFill,
              {
                width: progressPercent,
              },
            ]}
          />
        </View>
        {isCompleted ? (
          <View style={styles.completedContent}>
            <Trophy size={36} color={Colors.secondary} />
            <Text style={styles.completedText}>Parabéns!</Text>
            <Text style={styles.completedSubtext}>Sessão concluída</Text>
          </View>
        ) : (
          <View style={styles.timerContent}>
            <Text style={styles.timeText}>{timeStr}</Text>
            <Text style={styles.timeLabel}>
              {isRunning ? 'Focando...' : 'Pronto para focar'}
            </Text>
          </View>
        )}
      </Animated.View>

      <View style={styles.controls}>
        {!isCompleted ? (
          <Pressable
            onPress={toggleTimer}
            style={[styles.mainButton, isRunning && styles.mainButtonPause]}
            testID="focus-toggle"
          >
            {isRunning ? (
              <Pause size={28} color={Colors.textInverse} fill={Colors.textInverse} />
            ) : (
              <Play size={28} color={Colors.textInverse} fill={Colors.textInverse} />
            )}
          </Pressable>
        ) : null}

        {(secondsLeft < totalSeconds || isCompleted) && (
          <Pressable onPress={resetTimer} style={styles.resetButton} testID="focus-reset">
            <RotateCcw size={22} color={Colors.textSecondary} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  timerCircle: {
    width: 220,
    height: 220,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 6,
    overflow: 'hidden',
  },
  progressRing: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 6,
    backgroundColor: Colors.borderLight,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
  },
  timerContent: {
    alignItems: 'center',
  },
  timeText: {
    fontSize: 48,
    fontWeight: '200' as const,
    color: Colors.text,
    letterSpacing: 2,
  },
  timeLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 4,
    fontWeight: '500' as const,
  },
  completedContent: {
    alignItems: 'center',
  },
  completedText: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: Colors.secondary,
    marginTop: 8,
  },
  completedSubtext: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 28,
  },
  mainButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  mainButtonPause: {
    backgroundColor: Colors.accent,
  },
  resetButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
