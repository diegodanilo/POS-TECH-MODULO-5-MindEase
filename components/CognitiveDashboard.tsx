import Colors from '@/constants/colors';
import { useCognitiveEngine } from '@/contexts/CognitiveEngineContext';
import { useCognitiveProfile } from '@/contexts/CognitiveProfileContext';
import { focusPrediction } from '@/services/ai/focusPrediction';
import { habitLearning } from '@/services/ai/habitLearning';
import { sentimentAnalyzer } from '@/services/ai/sentimentAnalysis';
import { wearableService } from '@/services/ai/wearableIntegration';
import { Activity, Brain, Clock, Target, TrendingUp, Zap } from 'lucide-react-native';
import React, { useMemo } from 'react';
import {
  Animated,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface ChartBar {
  label: string;
  value: number;
  color: string;
}

interface InsightCard {
  icon: React.ReactNode;
  title: string;
  value: string;
  subtitle: string;
  trend: 'up' | 'down' | 'stable';
}

export default function CognitiveDashboard() {
  const { state } = useCognitiveEngine();
  const { profile: _profile } = useCognitiveProfile();

  const stats = useMemo(() => {
    const focusStats = focusPrediction.getSessionStats();
    const habit = habitLearning.getUserHabit();
    const wearable = wearableService.analyzeCognitiveState();
    const sentimentTrend = sentimentAnalyzer.analyzeTrend();

    return {
      focusStats,
      habit,
      wearable,
      sentimentTrend,
    };
  }, []);

  const insights = useMemo(() => {
    const items: InsightCard[] = [];

    // Focus Score
    items.push({
      icon: <Target size={20} color={Colors.focusScore.excellent} />,
      title: 'Foco Médio',
      value: `${Math.round(state.focusScore)}%`,
      subtitle: 'Última sessão',
      trend: state.focusScore > 60 ? 'up' : 'down',
    });

    // Total Sessions
    items.push({
      icon: <Activity size={20} color={Colors.secondary} />,
      title: 'Sessões',
      value: String(stats.focusStats.totalSessions),
      subtitle: 'Total acumulado',
      trend: 'stable',
    });

    // Completion Rate
    if (stats.habit) {
      items.push({
        icon: <TrendingUp size={20} color={Colors.primary} />,
        title: 'Conclusão',
        value: `${stats.habit.taskCompletionRate}%`,
        subtitle: 'Taxa de tarefas',
        trend: stats.habit.taskCompletionRate > 70 ? 'up' : 'stable',
      });
    }

    // Stress Level
    items.push({
      icon: <Zap size={20} color={getStressColor(stats.wearable.stressLevel.score)} />,
      title: 'Stress',
      value: `${stats.wearable.stressLevel.score}%`,
      subtitle: stats.wearable.stressLevel.level,
      trend: stats.wearable.stressLevel.score > 60 ? 'up' : 'down',
    });

    // Sentiment
    items.push({
      icon: <Brain size={20} color={sentimentAnalyzer.getSentimentColor(stats.sentimentTrend.averageScore)} />,
      title: 'Sentimento',
      value: stats.sentimentTrend.dominantEmotion,
      subtitle: 'Tendência',
      trend: stats.sentimentTrend.trendDirection === 'improving' ? 'up' : 'down',
    });

    // Optimal Time
    const prediction = focusPrediction.predictOptimalFocusTime();
    items.push({
      icon: <Clock size={20} color={Colors.primaryLight} />,
      title: 'Foco Ótimo',
      value: `${prediction.currentFocusPotential}%`,
      subtitle: 'Potencial agora',
      trend: prediction.currentFocusPotential > 70 ? 'up' : 'stable',
    });

    return items;
  }, [state, stats]);

  const weeklyData: ChartBar[] = useMemo(() => {
    const schedule = habitLearning.generateWeeklySchedule();
    return schedule.slice(0, 5).map((day) => ({
      label: day.day.slice(0, 3),
      value: day.recommendedHours.length * 20,
      color: day.recommendedHours.length > 2 ? Colors.secondary : Colors.primary,
    }));
  }, []);

  const focusInsights = useMemo(() => {
    return focusPrediction.getInsights();
  }, []);

  const sentimentInsights = useMemo(() => {
    return sentimentAnalyzer.generateInsights();
  }, []);

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.title}>Dashboard Cognitivo</Text>
        <Text style={styles.subtitle}>Análise comportamental em tempo real</Text>
      </View>

      {/* Quick Stats Grid */}
      <View style={styles.statsGrid}>
        {insights.slice(0, 4).map((insight) => (
          <View key={insight.title} style={styles.statCard}>
            <View style={styles.statIcon}>{insight.icon}</View>
            <Text style={styles.statValue}>{insight.value}</Text>
            <Text style={styles.statTitle}>{insight.title}</Text>
            <Text style={styles.statSubtitle}>{insight.subtitle}</Text>
          </View>
        ))}
      </View>

      {/* Weekly Pattern Chart */}
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>Padrão Semanal de Produtividade</Text>
        <View style={styles.chartContainer}>
          {weeklyData.map((bar, _index) => (
            <View key={bar.label} style={styles.barContainer}>
              <View style={styles.barWrapper}>
                <Animated.View
                  style={[
                    styles.bar,
                    {
                      height: `${Math.max(10, bar.value)}%`,
                      backgroundColor: bar.color,
                    },
                  ]}
                />
              </View>
              <Text style={styles.barLabel}>{bar.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Focus Insights */}
      <View style={styles.insightsCard}>
        <View style={styles.insightsHeader}>
          <Target size={18} color={Colors.primary} />
          <Text style={styles.insightsTitle}>Insights de Foco</Text>
        </View>
        {focusInsights.slice(0, 3).map((insight, idx) => (
          <View key={idx} style={styles.insightItem}>
            <View style={styles.insightDot} />
            <Text style={styles.insightText}>{insight}</Text>
          </View>
        ))}
      </View>

      {/* Sentiment Insights */}
      <View style={styles.insightsCard}>
        <View style={styles.insightsHeader}>
          <Brain size={18} color={Colors.secondary} />
          <Text style={styles.insightsTitle}>Análise Emocional</Text>
        </View>
        {sentimentInsights.slice(0, 3).map((insight, idx) => (
          <View key={idx} style={styles.insightItem}>
            <View style={[styles.insightDot, { backgroundColor: Colors.secondary }]} />
            <Text style={styles.insightText}>{insight}</Text>
          </View>
        ))}
      </View>

      {/* Circadian Profile */}
      {stats.habit && (
        <View style={styles.profileCard}>
          <Text style={styles.profileTitle}>Seu Perfil Cognitivo</Text>
          <View style={styles.profileGrid}>
            <View style={styles.profileItem}>
              <Text style={styles.profileValue}>{stats.habit.preferredBreakInterval}min</Text>
              <Text style={styles.profileLabel}>Pausa Ideal</Text>
            </View>
            <View style={styles.profileItem}>
              <Text style={styles.profileValue}>{stats.habit.productiveDays.length}</Text>
              <Text style={styles.profileLabel}>Dias Produtivos</Text>
            </View>
            <View style={styles.profileItem}>
              <Text style={styles.profileValue}>{stats.habit.commonTaskTypes.length}</Text>
              <Text style={styles.profileLabel}>Tipos Frequentes</Text>
            </View>
          </View>
        </View>
      )}

      {/* Wearable Data */}
      {wearableService.isWearableConnected() && (
        <View style={styles.wearableCard}>
          <View style={styles.wearableHeader}>
            <Activity size={18} color={Colors.accent} />
            <Text style={styles.wearableTitle}>Dados do Wearable</Text>
          </View>
          <View style={styles.wearableGrid}>
            <View style={styles.wearableItem}>
              <Text style={styles.wearableValue}>{stats.wearable.readinessScore}%</Text>
              <Text style={styles.wearableLabel}>Readiness</Text>
            </View>
            <View style={styles.wearableItem}>
              <Text style={styles.wearableValue}>{stats.wearable.physicalRecovery}%</Text>
              <Text style={styles.wearableLabel}>Recuperação</Text>
            </View>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

function getStressColor(score: number): string {
  if (score >= 70) return Colors.accent;
  if (score >= 50) return Colors.warning;
  return Colors.secondary;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    padding: 20,
    paddingTop: 60,
  },
  title: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 12,
    gap: 12,
  },
  statCard: {
    width: (SCREEN_WIDTH - 56) / 2,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 2,
  },
  statIcon: {
    marginBottom: 12,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  statTitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 4,
    fontWeight: '500' as const,
  },
  statSubtitle: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  chartCard: {
    backgroundColor: Colors.surface,
    margin: 16,
    borderRadius: 16,
    padding: 20,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 2,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 16,
  },
  chartContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 120,
    paddingBottom: 8,
  },
  barContainer: {
    alignItems: 'center',
    flex: 1,
  },
  barWrapper: {
    width: 32,
    height: 100,
    backgroundColor: Colors.borderLight,
    borderRadius: 6,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  bar: {
    width: '100%',
    borderRadius: 6,
  },
  barLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 8,
  },
  insightsCard: {
    backgroundColor: Colors.surface,
    margin: 16,
    marginTop: 0,
    borderRadius: 16,
    padding: 20,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 2,
  },
  insightsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  insightsTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  insightItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 10,
  },
  insightDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.primary,
    marginTop: 6,
  },
  insightText: {
    fontSize: 13,
    color: Colors.textSecondary,
    flex: 1,
    lineHeight: 18,
  },
  profileCard: {
    backgroundColor: Colors.surface,
    margin: 16,
    marginTop: 0,
    borderRadius: 16,
    padding: 20,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 2,
  },
  profileTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 16,
  },
  profileGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  profileItem: {
    alignItems: 'center',
  },
  profileValue: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  profileLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  wearableCard: {
    backgroundColor: Colors.surface,
    margin: 16,
    marginTop: 0,
    marginBottom: 32,
    borderRadius: 16,
    padding: 20,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 2,
  },
  wearableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  wearableTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  wearableGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  wearableItem: {
    alignItems: 'center',
  },
  wearableValue: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.accent,
  },
  wearableLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 4,
  },
});
