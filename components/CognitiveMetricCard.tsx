import Colors from '@/constants/colors';
import { useCognitiveProfile } from '@/contexts/CognitiveProfileContext';
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

interface CognitiveMetricCardProps {
  title: string;
  value: number;
  maxValue: number;
  unit?: string;
  color: string;
  icon: React.ReactNode;
  subtitle?: string;
}

export default function CognitiveMetricCard({
  title,
  value,
  maxValue,
  unit,
  color,
  icon,
  subtitle,
}: CognitiveMetricCardProps) {
  const { tokens } = useCognitiveProfile();
  const animatedWidth = useRef(new Animated.Value(0)).current;
  const animatedOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const percentage = Math.min((value / maxValue) * 100, 100);
    Animated.parallel([
      Animated.timing(animatedWidth, {
        toValue: percentage,
        duration: tokens.animationDuration > 0 ? 800 : 0,
        useNativeDriver: false,
      }),
      Animated.timing(animatedOpacity, {
        toValue: 1,
        duration: tokens.animationDuration > 0 ? 400 : 0,
        useNativeDriver: true,
      }),
    ]).start();
  }, [value, maxValue, tokens.animationDuration]);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          padding: tokens.spacing.card,
          borderRadius: tokens.borderRadius,
          opacity: animatedOpacity,
        },
      ]}
    >
      <View style={styles.header}>
        <View style={[styles.iconContainer, { backgroundColor: color + '18' }]}>
          {icon}
        </View>
        <View style={styles.headerText}>
          <Text style={[styles.title, { fontSize: tokens.fontSize.caption }]}>{title}</Text>
          <View style={styles.valueRow}>
            <Text style={[styles.value, { color, fontSize: tokens.fontSize.heading }]}>
              {Math.round(value)}
            </Text>
            {unit && (
              <Text style={[styles.unit, { fontSize: tokens.fontSize.caption }]}>{unit}</Text>
            )}
          </View>
        </View>
      </View>
      <View style={styles.progressTrack}>
        <Animated.View
          style={[
            styles.progressFill,
            {
              backgroundColor: color,
              borderRadius: 4,
              width: animatedWidth.interpolate({
                inputRange: [0, 100],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
      </View>
      {subtitle && (
        <Text style={[styles.subtitle, { fontSize: tokens.fontSize.caption }]}>{subtitle}</Text>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerText: {
    flex: 1,
  },
  title: {
    color: Colors.textSecondary,
    fontWeight: '500' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  value: {
    fontWeight: '700' as const,
  },
  unit: {
    color: Colors.textMuted,
    fontWeight: '500' as const,
  },
  progressTrack: {
    height: 6,
    backgroundColor: Colors.borderLight,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
  },
  subtitle: {
    color: Colors.textMuted,
    marginTop: 8,
  },
});
