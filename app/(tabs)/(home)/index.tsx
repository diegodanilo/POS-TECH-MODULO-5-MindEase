import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Brain,
  Target,
  Gauge,
  Timer,
  ListTodo,
  TrendingUp,
  Flame,
  ChevronRight,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useCognitiveProfile } from '@/contexts/CognitiveProfileContext';
import { useCognitiveEngine } from '@/contexts/CognitiveEngineContext';
import { useTasks } from '@/contexts/TaskContext';
import CognitiveMetricCard from '@/components/CognitiveMetricCard';
import BreathingWidget from '@/components/BreathingWidget';
import OverloadAlert from '@/components/OverloadAlert';

export default function HomeScreen() {
  const router = useRouter();
  const { profile, tokens } = useCognitiveProfile();
  const { state, takeBreak, dismissBreakSuggestion, getOverloadLevel } = useCognitiveEngine();
  const { pendingTasks, completedToday } = useTasks();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
  }, []);

  const overloadLevel = getOverloadLevel();
  const greeting = getGreeting();
  const overloadColor =
    overloadLevel === 'calm'
      ? Colors.secondary
      : overloadLevel === 'mild'
      ? Colors.primary
      : overloadLevel === 'moderate'
      ? Colors.warning
      : Colors.accent;

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <OverloadAlert
          visible={state.shouldSuggestBreak}
          onTakeBreak={takeBreak}
          onDismiss={dismissBreakSuggestion}
        />

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { padding: tokens.spacing.section }]}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
            <View style={styles.header}>
              <View>
                <Text style={[styles.greeting, { fontSize: tokens.fontSize.caption }]}>
                  {greeting}
                </Text>
                <Text style={[styles.name, { fontSize: tokens.fontSize.heading }]}>
                  {profile.name || 'MindEase'}
                </Text>
              </View>
              <View style={[styles.streakBadge, { backgroundColor: Colors.warningSoft }]}>
                <Flame size={16} color={Colors.warning} fill={Colors.warning} />
                <Text style={styles.streakText}>{state.currentStreak}</Text>
              </View>
            </View>

            <View style={[styles.stateCard, { borderRadius: tokens.borderRadius, borderLeftColor: overloadColor }]}>
              <View style={styles.stateHeader}>
                <Brain size={20} color={overloadColor} />
                <Text style={styles.stateTitle}>Estado Cognitivo</Text>
              </View>
              <View style={styles.stateRow}>
                <View style={styles.stateItem}>
                  <Text style={[styles.stateValue, { color: overloadColor }]}>
                    {getOverloadLabel(overloadLevel)}
                  </Text>
                  <Text style={styles.stateLabel}>Nível atual</Text>
                </View>
                <View style={styles.stateDivider} />
                <View style={styles.stateItem}>
                  <Text style={styles.stateValue}>{state.sessionDurationMinutes}min</Text>
                  <Text style={styles.stateLabel}>Sessão</Text>
                </View>
                <View style={styles.stateDivider} />
                <View style={styles.stateItem}>
                  <Text style={styles.stateValue}>{state.taskSwitchCount}</Text>
                  <Text style={styles.stateLabel}>Trocas</Text>
                </View>
              </View>
            </View>

            <View style={styles.metricsRow}>
              <View style={styles.metricHalf}>
                <CognitiveMetricCard
                  title="Foco"
                  value={state.focusScore}
                  maxValue={100}
                  unit="%"
                  color={getFocusColor(state.focusScore)}
                  icon={<Target size={18} color={getFocusColor(state.focusScore)} />}
                />
              </View>
              <View style={styles.metricHalf}>
                <CognitiveMetricCard
                  title="Sobrecarga"
                  value={state.overloadIndex}
                  maxValue={100}
                  unit="ISC"
                  color={overloadColor}
                  icon={<Gauge size={18} color={overloadColor} />}
                />
              </View>
            </View>

            {profile.complexity >= 2 && (
              <View style={styles.metricsRow}>
                <View style={styles.metricHalf}>
                  <CognitiveMetricCard
                    title="Concluídas"
                    value={completedToday}
                    maxValue={Math.max(pendingTasks.length + completedToday, 1)}
                    color={Colors.secondary}
                    icon={<TrendingUp size={18} color={Colors.secondary} />}
                    subtitle="hoje"
                  />
                </View>
                <View style={styles.metricHalf}>
                  <CognitiveMetricCard
                    title="Pendentes"
                    value={pendingTasks.length}
                    maxValue={Math.max(pendingTasks.length + completedToday, 1)}
                    color={Colors.primaryLight}
                    icon={<ListTodo size={18} color={Colors.primaryLight} />}
                  />
                </View>
              </View>
            )}

            <View style={styles.quickActions}>
              <Text style={[styles.sectionTitle, { fontSize: tokens.fontSize.subheading }]}>
                Ações Rápidas
              </Text>
              <View style={styles.actionsGrid}>
                <Pressable
                  style={[styles.actionCard, { backgroundColor: Colors.primarySoft }]}
                  onPress={() => router.push('/focus')}
                  testID="quick-focus"
                >
                  <Timer size={24} color={Colors.primary} />
                  <Text style={[styles.actionLabel, { color: Colors.primary }]}>Foco</Text>
                </Pressable>

                <Pressable
                  style={[styles.actionCard, { backgroundColor: Colors.secondarySoft }]}
                  onPress={() => router.push('/tasks')}
                  testID="quick-tasks"
                >
                  <ListTodo size={24} color={Colors.secondary} />
                  <Text style={[styles.actionLabel, { color: Colors.secondary }]}>Tarefas</Text>
                </Pressable>

                <BreathingWidget compact />
              </View>
            </View>

            {pendingTasks.length > 0 && (
              <View style={styles.upNext}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { fontSize: tokens.fontSize.subheading }]}>
                    Próxima Tarefa
                  </Text>
                  <Pressable onPress={() => router.push('/tasks')} style={styles.seeAllBtn}>
                    <Text style={styles.seeAllText}>Ver todas</Text>
                    <ChevronRight size={14} color={Colors.primary} />
                  </Pressable>
                </View>
                <View style={[styles.nextTaskCard, { borderRadius: tokens.borderRadius }]}>
                  <View style={styles.nextTaskContent}>
                    <Text style={[styles.nextTaskTitle, { fontSize: tokens.fontSize.body }]}>
                      {pendingTasks[0].title}
                    </Text>
                    {profile.complexity >= 2 && pendingTasks[0].description ? (
                      <Text style={styles.nextTaskDesc} numberOfLines={1}>
                        {pendingTasks[0].description}
                      </Text>
                    ) : null}
                    <View style={styles.nextTaskMeta}>
                      <View
                        style={[
                          styles.nextTaskBadge,
                          { backgroundColor: Colors.cognitiveLoad[pendingTasks[0].cognitiveLoad] + '18' },
                        ]}
                      >
                        <Text
                          style={[
                            styles.nextTaskBadgeText,
                            { color: Colors.cognitiveLoad[pendingTasks[0].cognitiveLoad] },
                          ]}
                        >
                          {pendingTasks[0].estimatedMinutes}min
                        </Text>
                      </View>
                    </View>
                  </View>
                  <ChevronRight size={20} color={Colors.textMuted} />
                </View>
              </View>
            )}
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

function getOverloadLabel(level: string): string {
  switch (level) {
    case 'calm': return 'Calmo';
    case 'mild': return 'Leve';
    case 'moderate': return 'Moderado';
    case 'high': return 'Alto';
    default: return 'Calmo';
  }
}

function getFocusColor(score: number): string {
  if (score >= 80) return Colors.focusScore.excellent;
  if (score >= 60) return Colors.focusScore.good;
  if (score >= 40) return Colors.focusScore.moderate;
  return Colors.focusScore.low;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  safeArea: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  greeting: {
    color: Colors.textSecondary,
    fontWeight: '500' as const,
    marginBottom: 2,
  },
  name: {
    color: Colors.text,
    fontWeight: '700' as const,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  streakText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.warning,
  },
  stateCard: {
    backgroundColor: Colors.surface,
    padding: 18,
    marginBottom: 16,
    borderLeftWidth: 4,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 3,
  },
  stateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  stateTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  stateRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stateItem: {
    flex: 1,
    alignItems: 'center',
  },
  stateValue: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  stateLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
    fontWeight: '500' as const,
  },
  stateDivider: {
    width: 1,
    height: 30,
    backgroundColor: Colors.borderLight,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  metricHalf: {
    flex: 1,
  },
  quickActions: {
    marginTop: 8,
    marginBottom: 20,
  },
  sectionTitle: {
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 14,
  },
  actionsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  actionCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    borderRadius: 16,
    gap: 8,
  },
  actionLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  upNext: {
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  seeAllText: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '600' as const,
  },
  nextTaskCard: {
    backgroundColor: Colors.surface,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 2,
  },
  nextTaskContent: {
    flex: 1,
  },
  nextTaskTitle: {
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  nextTaskDesc: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  nextTaskMeta: {
    flexDirection: 'row',
  },
  nextTaskBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  nextTaskBadgeText: {
    fontSize: 11,
    fontWeight: '600' as const,
  },
});
