import { Task } from '@/types/mindease';
import { focusPrediction } from './focusPrediction';
import { sentimentAnalyzer } from './sentimentAnalysis';
import { wearableService } from './wearableIntegration';

interface OptimizedColumn {
  id: string;
  title: string;
  tasks: Task[];
  cognitiveLoad: 'low' | 'medium' | 'high';
  estimatedTime: number;
}

interface KanbanOptimization {
  columns: OptimizedColumn[];
  rationale: string[];
  reorderingChanges: Array<{
    taskId: string;
    from: string;
    to: string;
    reason: string;
  }>;
  recommendedStartTask: string | null;
}

interface TaskScore {
  task: Task;
  score: number;
  factors: string[];
}

export class KanbanOptimizer {
  optimizeKanban(
    tasks: Task[],
    currentState: {
      overloadIndex: number;
      focusScore: number;
      timeOfDay: number;
    }
  ): KanbanOptimization {
    const scoredTasks = this.scoreTasks(tasks, currentState);
    const sortedTasks = this.sortTasksByScore(scoredTasks);
    
    const columns = this.organizeIntoColumns(sortedTasks, currentState);
    const rationale = this.generateRationale(scoredTasks, currentState);
    const changes = this.detectChanges(tasks, sortedTasks);
    
    const recommendedStart = this.selectStartingTask(sortedTasks, currentState);

    return {
      columns,
      rationale,
      reorderingChanges: changes,
      recommendedStartTask: recommendedStart?.id || null,
    };
  }

  private scoreTasks(
    tasks: Task[],
    currentState: { overloadIndex: number; focusScore: number; timeOfDay: number }
  ): TaskScore[] {
    return tasks.map(task => {
      let score = 0;
      const factors: string[] = [];

      // Cognitive load as priority proxy
      const loadWeights = { high: 30, medium: 20, low: 10 };
      score += loadWeights[task.cognitiveLoad];

      // Cognitive load vs current state
      if (currentState.overloadIndex > 60) {
        if (task.cognitiveLoad === 'low') {
          score += 25;
          factors.push('Baixa carga cognitiva (estado atual de sobrecarga)');
        } else if (task.cognitiveLoad === 'high') {
          score -= 20;
          factors.push('Alta carga cognitiva desaconselhada agora');
        }
      } else if (currentState.focusScore > 70) {
        if (task.cognitiveLoad === 'high') {
          score += 15;
          factors.push('Foco alto - adequado para tarefas complexas');
        }
      }

      // Estimated time appropriateness
      const timeRemaining = 24 - currentState.timeOfDay;
      if (task.estimatedMinutes && task.estimatedMinutes > timeRemaining * 60) {
        score -= 15;
        factors.push('Tempo estimado excede disponibilidade');
      }

      // Sentiment analysis
      const sentiment = sentimentAnalyzer.analyzeTask(task.title, task.description);
      if (sentiment.urgencyDetected) {
        score += 20;
        factors.push('Urgência detectada no texto');
      }
      if (sentiment.overallSentiment === 'negative') {
        score += 10;
        factors.push('Tarefa com carga emocional negativa - priorizar resolução');
      }

      // Completion status check
      if (task.status === 'in_progress') {
        score += 20;
        factors.push('Tarefa em andamento');
      }

      // Energy level matching
      const wearableData = wearableService.analyzeCognitiveState();
      if (wearableData.readinessScore < 50 && task.cognitiveLoad === 'low') {
        score += 15;
        factors.push('Compatível com baixa energia atual');
      }

      return { task, score, factors };
    });
  }

  private sortTasksByScore(scoredTasks: TaskScore[]): TaskScore[] {
    return [...scoredTasks].sort((a, b) => b.score - a.score);
  }

  private organizeIntoColumns(
    sortedTasks: TaskScore[],
    currentState: { overloadIndex: number; focusScore: number }
  ): OptimizedColumn[] {
    const columns: OptimizedColumn[] = [
      { id: 'do-now', title: 'Fazer Agora', tasks: [], cognitiveLoad: 'low', estimatedTime: 0 },
      { id: 'next-up', title: 'Próximas', tasks: [], cognitiveLoad: 'medium', estimatedTime: 0 },
      { id: 'scheduled', title: 'Agendadas', tasks: [], cognitiveLoad: 'high', estimatedTime: 0 },
      { id: 'later', title: 'Depois', tasks: [], cognitiveLoad: 'low', estimatedTime: 0 },
    ];

    const maxTasksPerColumn = currentState.overloadIndex > 70 ? 3 : 5;

    for (const { task } of sortedTasks) {
      if (columns[0].tasks.length < maxTasksPerColumn && task.cognitiveLoad !== 'high') {
        columns[0].tasks.push(task);
        columns[0].estimatedTime += task.estimatedMinutes || 30;
      } else if (columns[1].tasks.length < maxTasksPerColumn) {
        columns[1].tasks.push(task);
        columns[1].estimatedTime += task.estimatedMinutes || 30;
      } else if (task.cognitiveLoad === 'high' && currentState.focusScore < 60) {
        columns[2].tasks.push(task);
        columns[2].estimatedTime += task.estimatedMinutes || 60;
      } else {
        columns[3].tasks.push(task);
        columns[3].estimatedTime += task.estimatedMinutes || 30;
      }
    }

    // Adjust cognitive load labels based on tasks
    columns.forEach(col => {
      const loads = col.tasks.map(t => t.cognitiveLoad);
      if (loads.filter(l => l === 'high').length > loads.length / 2) {
        col.cognitiveLoad = 'high';
      } else if (loads.filter(l => l === 'medium').length > loads.length / 2) {
        col.cognitiveLoad = 'medium';
      }
    });

    return columns.filter(col => col.tasks.length > 0);
  }

  private generateRationale(
    scoredTasks: TaskScore[],
    currentState: { overloadIndex: number; focusScore: number }
  ): string[] {
    const rationale: string[] = [];

    if (currentState.overloadIndex > 60) {
      rationale.push('Priorizando tarefas de baixa carga cognitiva devido à sobrecarga atual');
    }

    if (currentState.focusScore > 75) {
      rationale.push('Foco elevado detectado - tarefas complexas posicionadas estrategicamente');
    }

    const urgentTasks = scoredTasks.filter(
      s => s.factors.some(f => f.includes('Vence em'))
    );
    if (urgentTasks.length > 0) {
      rationale.push(`${urgentTasks.length} tarefa(s) com prazo crítico priorizada(s)`);
    }

    const highStressTasks = scoredTasks.filter(
      s => s.factors.some(f => f.includes('emocional'))
    );
    if (highStressTasks.length > 0) {
      rationale.push('Tarefas com carga emocional elevada priorizadas para redução de ansiedade');
    }

    const wearableData = wearableService.analyzeCognitiveState();
    if (wearableData.readinessScore < 50) {
      rationale.push('Energia física baixa - complexidade das tarefas ajustada');
    }

    return rationale.length > 0 
      ? rationale 
      : ['Kanban organizado por prioridade e prazo'];
  }

  private detectChanges(
    originalTasks: Task[],
    sortedTasks: TaskScore[]
  ): KanbanOptimization['reorderingChanges'] {
    const changes: KanbanOptimization['reorderingChanges'] = [];
    const originalOrder = new Map(originalTasks.map((t, i) => [t.id, i]));
    
    sortedTasks.forEach((scored, newIndex) => {
      const oldIndex = originalOrder.get(scored.task.id);
      if (oldIndex !== undefined && Math.abs(oldIndex - newIndex) > 2) {
        changes.push({
          taskId: scored.task.id,
          from: `posição ${oldIndex + 1}`,
          to: `posição ${newIndex + 1}`,
          reason: scored.factors[0] || 'Reordenação por prioridade dinâmica',
        });
      }
    });

    return changes.slice(0, 5);
  }

  private selectStartingTask(
    sortedTasks: TaskScore[],
    currentState: { overloadIndex: number }
  ): Task | null {
    if (sortedTasks.length === 0) return null;

    // Filter tasks appropriate for current state
    const suitableTasks = sortedTasks.filter(({ task }) => {
      if (currentState.overloadIndex > 70) {
        return task.cognitiveLoad === 'low' && (task.estimatedMinutes || 30) <= 30;
      }
      if (currentState.overloadIndex > 50) {
        return task.cognitiveLoad !== 'high';
      }
      return true;
    });

    return suitableTasks[0]?.task || sortedTasks[0].task;
  }

  suggestBatchOperations(tasks: Task[]): Array<{
    type: 'group' | 'reorder' | 'defer';
    tasks: string[];
    reason: string;
  }> {
    const suggestions: ReturnType<typeof this.suggestBatchOperations> = [];

    // Group similar tasks
    const byCognitiveLoad = this.groupBy(tasks, 'cognitiveLoad');
    Object.entries(byCognitiveLoad).forEach(([load, loadTasks]) => {
      if (loadTasks.length >= 3) {
        suggestions.push({
          type: 'group',
          tasks: loadTasks.map(t => t.id),
          reason: `${loadTasks.length} tarefas de carga ${load} podem ser agrupadas`,
        });
      }
    });

    // Identify tasks to defer
    const deferrable = tasks.filter(t => 
      t.status === 'pending' && 
      t.cognitiveLoad === 'high'
    );
    if (deferrable.length > 2) {
      suggestions.push({
        type: 'defer',
        tasks: deferrable.map(t => t.id),
        reason: 'Tarefas de baixa prioridade e alta complexidade podem ser adiadas',
      });
    }

    return suggestions;
  }

  private groupBy<T extends Task>(
    tasks: T[],
    key: keyof T
  ): Record<string, T[]> {
    return tasks.reduce((groups, task) => {
      const value = String(task[key]);
      if (!groups[value]) groups[value] = [];
      groups[value].push(task);
      return groups;
    }, {} as Record<string, T[]>);
  }

  generateFocusBlocks(tasks: Task[]): Array<{
    startHour: number;
    duration: number;
    tasks: string[];
    rationale: string;
  }> {
    const prediction = focusPrediction.predictOptimalFocusTime();
    const blocks: ReturnType<typeof this.generateFocusBlocks> = [];

    prediction.optimalWindows.slice(0, 2).forEach(window => {
      const start = new Date(window.start);
      const end = new Date(window.end);
      const duration = (end.getTime() - start.getTime()) / 60000;

      // Select tasks for this block
      const blockTasks = tasks
        .filter(t => !t.completedAt)
        .slice(0, Math.floor(duration / 25));

      if (blockTasks.length > 0) {
        blocks.push({
          startHour: start.getHours(),
          duration: Math.floor(duration),
          tasks: blockTasks.map(t => t.id),
          rationale: `Bloco de foco durante horário de pico (${start.getHours()}:00)`,
        });
      }
    });

    return blocks;
  }
}

export const kanbanOptimizer = new KanbanOptimizer();
