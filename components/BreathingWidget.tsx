import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native';
import { Wind } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';

interface BreathingWidgetProps {
  compact?: boolean;
}

const PHASES = ['Inspire', 'Segure', 'Expire', 'Segure'] as const;
const PHASE_DURATIONS = [4000, 4000, 4000, 2000];

export default function BreathingWidget({ compact = false }: BreathingWidgetProps) {
  const [isActive, setIsActive] = useState(false);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [countdown, setCountdown] = useState(4);
  const scaleAnim = useRef(new Animated.Value(0.6)).current;
  const opacityAnim = useRef(new Animated.Value(0.4)).current;
  const phaseRef = useRef(0);

  const runPhase = useCallback((index: number) => {
    phaseRef.current = index;
    setPhaseIndex(index);
    const duration = PHASE_DURATIONS[index];
    setCountdown(Math.floor(duration / 1000));

    const targetScale = index === 0 ? 1 : index === 2 ? 0.6 : index === 1 ? 1 : 0.6;
    const targetOpacity = index === 0 ? 1 : index === 2 ? 0.4 : index === 1 ? 0.9 : 0.5;

    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: targetScale,
        duration,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: targetOpacity,
        duration,
        useNativeDriver: true,
      }),
    ]).start();
  }, [scaleAnim, opacityAnim]);

  useEffect(() => {
    if (!isActive) return;

    runPhase(0);

    const countdownInterval = setInterval(() => {
      setCountdown((prev) => (prev > 1 ? prev - 1 : prev));
    }, 1000);

    const phaseInterval = setInterval(() => {
      const next = (phaseRef.current + 1) % 4;
      runPhase(next);
    }, 4000);

    return () => {
      clearInterval(countdownInterval);
      clearInterval(phaseInterval);
    };
  }, [isActive, runPhase]);

  const toggleBreathing = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsActive(!isActive);
    if (!isActive) {
      scaleAnim.setValue(0.6);
      opacityAnim.setValue(0.4);
    }
  };

  if (compact) {
    return (
      <Pressable onPress={toggleBreathing} style={styles.compactContainer} testID="breathing-compact">
        <View style={[styles.compactCircle, isActive && styles.compactCircleActive]}>
          <Wind size={18} color={isActive ? Colors.textInverse : Colors.primary} />
        </View>
        <Text style={styles.compactLabel}>
          {isActive ? PHASES[phaseIndex] : 'Respirar'}
        </Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.container} testID="breathing-widget">
      <Text style={styles.headerText}>Exercício de Respiração</Text>
      <Pressable onPress={toggleBreathing} style={styles.circleArea}>
        <Animated.View
          style={[
            styles.breathCircle,
            {
              transform: [{ scale: scaleAnim }],
              opacity: opacityAnim,
            },
          ]}
        />
        <View style={styles.circleContent}>
          {isActive ? (
            <>
              <Text style={styles.phaseText}>{PHASES[phaseIndex]}</Text>
              <Text style={styles.countdownText}>{countdown}</Text>
            </>
          ) : (
            <>
              <Wind size={28} color={Colors.primary} />
              <Text style={styles.startText}>Toque para{'\n'}iniciar</Text>
            </>
          )}
        </View>
      </Pressable>
      {isActive && (
        <Text style={styles.hint}>Toque para parar</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  headerText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 20,
  },
  circleArea: {
    width: 160,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  breathCircle: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: Colors.primarySoft,
    borderWidth: 2,
    borderColor: Colors.primaryLight,
  },
  circleContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  phaseText: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  countdownText: {
    fontSize: 32,
    fontWeight: '700' as const,
    color: Colors.primary,
    marginTop: 4,
  },
  startText: {
    fontSize: 13,
    color: Colors.primaryLight,
    textAlign: 'center',
    marginTop: 8,
    fontWeight: '500' as const,
  },
  hint: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 16,
  },
  compactContainer: {
    alignItems: 'center',
    gap: 6,
  },
  compactCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactCircleActive: {
    backgroundColor: Colors.primary,
  },
  compactLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
});
