import { useEffect, useState, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import createContextHook from '@nkzw/create-context-hook';
import { Task, TaskStatus, TaskCognitiveLoad } from '@/types/mindease';
import { defaultTasks } from '@/mocks/tasks';

const TASKS_KEY = 'mindease_tasks';

export const [TaskProvider, useTasks] = createContextHook(() => {
  const queryClient = useQueryClient();
  const [tasks, setTasks] = useState<Task[]>([]);

  const tasksQuery = useQuery({
    queryKey: ['tasks'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(TASKS_KEY);
      if (stored) {
        return JSON.parse(stored) as Task[];
      }
      await AsyncStorage.setItem(TASKS_KEY, JSON.stringify(defaultTasks));
      return defaultTasks;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (updated: Task[]) => {
      await AsyncStorage.setItem(TASKS_KEY, JSON.stringify(updated));
      return updated;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['tasks'], data);
    },
  });

  useEffect(() => {
    if (tasksQuery.data) {
      setTasks(tasksQuery.data);
    }
  }, [tasksQuery.data]);

  const { mutate } = saveMutation;

  const addTask = useCallback((task: Omit<Task, 'id' | 'createdAt'>) => {
    const newTask: Task = {
      ...task,
      id: Date.now().toString(),
      createdAt: Date.now(),
    };
    const updated = [newTask, ...tasks];
    setTasks(updated);
    mutate(updated);
  }, [tasks, mutate]);

  const updateTaskStatus = useCallback((id: string, status: TaskStatus) => {
    const updated = tasks.map((t) =>
      t.id === id
        ? { ...t, status, completedAt: status === 'completed' ? Date.now() : undefined }
        : t
    );
    setTasks(updated);
    mutate(updated);
  }, [tasks, mutate]);

  const deleteTask = useCallback((id: string) => {
    const updated = tasks.filter((t) => t.id !== id);
    setTasks(updated);
    mutate(updated);
  }, [tasks, mutate]);

  const pendingTasks = useMemo(() => tasks.filter((t) => t.status !== 'completed'), [tasks]);
  const completedTasks = useMemo(() => tasks.filter((t) => t.status === 'completed'), [tasks]);
  const completedToday = useMemo(() => {
    const today = new Date().toDateString();
    return tasks.filter(
      (t) => t.status === 'completed' && t.completedAt && new Date(t.completedAt).toDateString() === today
    ).length;
  }, [tasks]);

  return {
    tasks,
    pendingTasks,
    completedTasks,
    completedToday,
    isLoading: tasksQuery.isLoading,
    addTask,
    updateTaskStatus,
    deleteTask,
  };
});

export function useTasksByLoad(load?: TaskCognitiveLoad) {
  const { pendingTasks } = useTasks();
  return useMemo(
    () => (load ? pendingTasks.filter((t) => t.cognitiveLoad === load) : pendingTasks),
    [pendingTasks, load]
  );
}
