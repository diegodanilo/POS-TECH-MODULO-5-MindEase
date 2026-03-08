import React, { useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native';
import { CheckCircle, Circle, Clock, Zap } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { Task, TaskCognitiveLoad } from '@/types/mindease';
import { useCognitiveProfile } from '@/contexts/CognitiveProfileContext';

interface TaskCardProps {
  task: Task;
  onToggle: () => void;
  onPress?: () => void;
}

const loadLabels: Record<TaskCognitiveLoad, string> = {
  low: 'Leve',
  medium: 'Moderado',
  high: 'Intenso',
};

const loadIcons: Record<TaskCognitiveLoad, number> = {
  low: 1,
  medium: 2,
  high: 3,
};

export default function TaskCard({ task, onToggle, onPress }: TaskCardProps) {
  const { tokens, profile } = useCognitiveProfile();
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const isCompleted = task.status === 'completed';

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 3,
      useNativeDriver: true,
    }).start();
  };

  const handleToggle = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onToggle();
  };

  const loadColor = Colors.cognitiveLoad[task.cognitiveLoad];

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[
          styles.container,
          {
            padding: tokens.spacing.card,
            borderRadius: tokens.borderRadius,
            opacity: isCompleted ? 0.6 : 1,
          },
        ]}
        testID={`task-card-${task.id}`}
      >
        <Pressable onPress={handleToggle} style={styles.checkbox} testID={`task-toggle-${task.id}`}>
          {isCompleted ? (
            <CheckCircle size={24} color={Colors.secondary} />
          ) : (
            <Circle size={24} color={Colors.textMuted} />
          )}
        </Pressable>

        <View style={styles.content}>
          <Text
            style={[
              styles.title,
              {
                fontSize: tokens.fontSize.body,
                textDecorationLine: isCompleted ? 'line-through' : 'none',
                color: isCompleted ? Colors.textMuted : Colors.text,
              },
            ]}
            numberOfLines={profile.complexity === 1 ? 1 : 2}
          >
            {task.title}
          </Text>

          {profile.complexity >= 2 && task.description ? (
            <Text
              style={[styles.description, { fontSize: tokens.fontSize.caption }]}
              numberOfLines={1}
            >
              {task.description}
            </Text>
          ) : null}

          <View style={styles.meta}>
            <View style={[styles.loadBadge, { backgroundColor: loadColor + '18' }]}>
              {Array.from({ length: loadIcons[task.cognitiveLoad] }).map((_, i) => (
                <Zap key={i} size={10} color={loadColor} fill={loadColor} />
              ))}
              <Text style={[styles.loadText, { color: loadColor }]}>
                {loadLabels[task.cognitiveLoad]}
              </Text>
            </View>

            <View style={styles.timeBadge}>
              <Clock size={11} color={Colors.textMuted} />
              <Text style={styles.timeText}>{task.estimatedMinutes}min</Text>
            </View>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    flexDirection: 'row',
    alignItems: 'flex-start',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.6,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: 10,
  },
  checkbox: {
    marginRight: 12,
    marginTop: 2,
    padding: 2,
  },
  content: {
    flex: 1,
  },
  title: {
    fontWeight: '600' as const,
    marginBottom: 4,
  },
  description: {
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 2,
  },
  loadText: {
    fontSize: 11,
    fontWeight: '600' as const,
    marginLeft: 2,
  },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  timeText: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '500' as const,
  },
});
