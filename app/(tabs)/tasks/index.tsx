import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus, CheckCircle2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { TaskCognitiveLoad, TaskStatus } from '@/types/mindease';
import { useCognitiveProfile } from '@/contexts/CognitiveProfileContext';
import { useCognitiveEngine } from '@/contexts/CognitiveEngineContext';
import { useTasks } from '@/contexts/TaskContext';
import TaskCard from '@/components/TaskCard';
import AddTaskModal from '@/components/AddTaskModal';

type FilterOption = 'all' | TaskCognitiveLoad;

const filters: { value: FilterOption; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'low', label: 'Leve' },
  { value: 'medium', label: 'Moderado' },
  { value: 'high', label: 'Intenso' },
];

export default function TasksScreen() {
  const { tokens, profile } = useCognitiveProfile();
  const { recordTaskSwitch } = useCognitiveEngine();
  const { pendingTasks, completedTasks, completedToday, updateTaskStatus, addTask } = useTasks();
  const [filter, setFilter] = useState<FilterOption>('all');
  const [showAdd, setShowAdd] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);

  const filteredTasks = filter === 'all'
    ? pendingTasks
    : pendingTasks.filter((t) => t.cognitiveLoad === filter);

  const handleToggle = useCallback(
    (id: string, currentStatus: TaskStatus) => {
      recordTaskSwitch();
      const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';
      updateTaskStatus(id, newStatus);
    },
    [updateTaskStatus, recordTaskSwitch]
  );

  const handleAdd = useCallback(
    (task: { title: string; description: string; cognitiveLoad: TaskCognitiveLoad; estimatedMinutes: number; tags: string[]; status: 'pending' }) => {
      addTask(task);
    },
    [addTask]
  );

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
          <View>
            <Text style={[styles.title, { fontSize: tokens.fontSize.heading }]}>Tarefas</Text>
            <Text style={styles.subtitle}>
              {completedToday} concluída{completedToday !== 1 ? 's' : ''} hoje
            </Text>
          </View>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setShowAdd(true);
            }}
            style={styles.addBtn}
            testID="add-task-btn"
          >
            <Plus size={22} color={Colors.textInverse} />
          </Pressable>
        </Animated.View>

        <View style={styles.filterRow}>
          {filters.map((f) => (
            <Pressable
              key={f.value}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setFilter(f.value);
              }}
              style={[
                styles.filterChip,
                filter === f.value && styles.filterChipActive,
              ]}
              testID={`filter-${f.value}`}
            >
              <Text
                style={[
                  styles.filterText,
                  filter === f.value && styles.filterTextActive,
                ]}
              >
                {f.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <FlatList
          data={filteredTasks}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.list,
            { paddingHorizontal: tokens.spacing.section },
          ]}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <TaskCard
              task={item}
              onToggle={() => handleToggle(item.id, item.status)}
            />
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <CheckCircle2 size={48} color={Colors.borderLight} />
              <Text style={styles.emptyTitle}>Tudo limpo!</Text>
              <Text style={styles.emptyText}>
                Nenhuma tarefa{filter !== 'all' ? ' nesta categoria' : ''} pendente
              </Text>
            </View>
          }
          ListFooterComponent={
            profile.complexity >= 2 && completedTasks.length > 0 ? (
              <View style={styles.completedSection}>
                <Pressable
                  onPress={() => setShowCompleted(!showCompleted)}
                  style={styles.completedToggle}
                >
                  <Text style={styles.completedToggleText}>
                    {showCompleted ? 'Ocultar' : 'Mostrar'} concluídas ({completedTasks.length})
                  </Text>
                </Pressable>
                {showCompleted &&
                  completedTasks.slice(0, tokens.maxItemsVisible).map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onToggle={() => handleToggle(task.id, task.status)}
                    />
                  ))}
              </View>
            ) : null
          }
        />

        <AddTaskModal
          visible={showAdd}
          onClose={() => setShowAdd(false)}
          onAdd={handleAdd}
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  title: {
    fontWeight: '700' as const,
    color: Colors.text,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 16,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  filterChipActive: {
    backgroundColor: Colors.primarySoft,
    borderColor: Colors.primary,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textMuted,
  },
  filterTextActive: {
    color: Colors.primary,
  },
  list: {
    paddingBottom: 20,
  },
  empty: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
    marginTop: 4,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textMuted,
  },
  completedSection: {
    marginTop: 16,
  },
  completedToggle: {
    paddingVertical: 10,
    marginBottom: 8,
  },
  completedToggleText: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '600' as const,
  },
});
