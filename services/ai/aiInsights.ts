import { BehavioralPattern, CognitiveMetricsSnapshot, DailyCognitiveReport } from '@/types/ai';
import { generateObject, generateText } from '@rork-ai/toolkit-sdk';
import { z } from 'zod';

interface InsightContext {
  report: DailyCognitiveReport;
  previousReports?: DailyCognitiveReport[];
  userConditions?: string[];
  goals?: string[];
}

interface PersonalizedInsight {
  id: string;
  category: 'performance' | 'wellbeing' | 'strategy' | 'motivation';
  title: string;
  content: string;
  actionable: boolean;
  action?: {
    label: string;
    type: 'start_focus' | 'take_break' | 'adjust_complexity' | 'review_tasks';
  };
  confidence: number;
}

const InsightSchema = z.object({
  insights: z.array(z.object({
    category: z.enum(['performance', 'wellbeing', 'strategy', 'motivation']),
    title: z.string(),
    content: z.string(),
    actionable: z.boolean(),
    actionLabel: z.string().optional(),
    actionType: z.enum(['start_focus', 'take_break', 'adjust_complexity', 'review_tasks']).optional(),
    confidence: z.number().min(0).max(1),
  })),
  summary: z.string(),
  trendAnalysis: z.string(),
});

export async function generatePersonalizedInsights(
  context: InsightContext
): Promise<PersonalizedInsight[]> {
  const messages = [
    {
      role: 'user' as const,
      content: `Analise este relatório cognitivo e gere insights personalizados:

Relatório de hoje:
- Data: ${context.report.date}
- Tempo total de foco: ${context.report.summary.totalFocusTime} minutos
- Score médio de foco: ${context.report.summary.averageFocusScore}/100
- Eventos de sobrecarga: ${context.report.summary.overloadEvents}
- Pausas realizadas: ${context.report.summary.breaksTaken}
- Tarefas completadas: ${context.report.summary.tasksCompleted}
- Tendência: ${context.report.trend}

Padrões detectados: ${context.report.patterns.map(p => p.patternType).join(', ') || 'Nenhum padrão claro'}

${context.userConditions ? `Condições cognitivas: ${context.userConditions.join(', ')}` : ''}
${context.goals ? `Metas: ${context.goals.join(', ')}` : ''}

Forneça insights que sejam:
1. Específicos para neurodiversidade (TDAH, TEA, dislexia, burnout)
2. Empáticos e não-julgadores
3. Baseados em evidências do relatório
4. Ação-orientados quando apropriado`,
    },
  ];

  try {
    const result = await generateObject({
      messages,
      schema: InsightSchema,
    });

    return result.insights.map((insight, index) => ({
      id: `insight_${Date.now()}_${index}`,
      category: insight.category,
      title: insight.title,
      content: insight.content,
      actionable: insight.actionable,
      action: insight.actionable && insight.actionType
        ? {
            label: insight.actionLabel || 'Agir',
            type: insight.actionType,
          }
        : undefined,
      confidence: insight.confidence,
    }));
  } catch {
    return generateFallbackInsights(context);
  }
}

export async function generateCoachingMessage(
  pattern: BehavioralPattern,
  currentMetrics: CognitiveMetricsSnapshot
): Promise<string> {
  const messages = [
    {
      role: 'user' as const,
      content: `Gere uma mensagem de coaching breve e encorajadora baseada neste padrão:

Padrão: ${pattern.patternType}
Confiança: ${Math.round(pattern.confidence * 100)}%
Evidências: ${pattern.supportingEvidence.join(', ')}

Métricas atuais:
- Focus Score: ${currentMetrics.focusScore}/100
- Overload Index: ${currentMetrics.overloadIndex}/100
- Duração da sessão: ${currentMetrics.sessionDuration} min

A mensagem deve ser:
- Máximo 2 frases
- Empática e prática
- Sem jargões técnicos
- Em português do Brasil`,
    },
  ];

  try {
    return await generateText({ messages });
  } catch {
    return generateFallbackCoaching(pattern);
  }
}

export async function analyzeTaskComplexity(
  taskTitle: string,
  taskDescription: string,
  userComplexity: number
): Promise<{
  estimatedLoad: 'low' | 'medium' | 'high';
  estimatedMinutes: number;
  suggestions: string[];
  shouldBreakDown: boolean;
}> {
  const TaskAnalysisSchema = z.object({
    estimatedLoad: z.enum(['low', 'medium', 'high']),
    estimatedMinutes: z.number().min(5).max(240),
    suggestions: z.array(z.string()).max(3),
    shouldBreakDown: z.boolean(),
    reasoning: z.string(),
  });

  const messages = [
    {
      role: 'user' as const,
      content: `Analise esta tarefa considerando um usuário com preferência de complexidade ${userComplexity}/3:

Título: ${taskTitle}
Descrição: ${taskDescription || 'Sem descrição'}

Forneça uma análise que considere:
- Carga cognitiva da tarefa
- Tempo estimado realista
- Se deve ser dividida em subtarefas
- Sugestões específicas para neurodiversidade`,
    },
  ];

  try {
    const result = await generateObject({
      messages,
      schema: TaskAnalysisSchema,
    });

    return {
      estimatedLoad: result.estimatedLoad,
      estimatedMinutes: result.estimatedMinutes,
      suggestions: result.suggestions,
      shouldBreakDown: result.shouldBreakDown,
    };
  } catch {
    return {
      estimatedLoad: 'medium',
      estimatedMinutes: 30,
      suggestions: ['Divida em etapas menores se possível'],
      shouldBreakDown: false,
    };
  }
}

function generateFallbackInsights(context: InsightContext): PersonalizedInsight[] {
  const insights: PersonalizedInsight[] = [];
  const { report } = context;

  if (report.trend === 'improving') {
    insights.push({
      id: `fb_${Date.now()}_1`,
      category: 'motivation',
      title: 'Ótimo progresso!',
      content: 'Seu desempenho cognitivo está em ascensão. Continue com os hábitos que têm funcionado para você.',
      actionable: false,
      confidence: 0.8,
    });
  }

  if (report.summary.overloadEvents > 2) {
    insights.push({
      id: `fb_${Date.now()}_2`,
      category: 'wellbeing',
      title: 'Cuide da sua carga mental',
      content: 'Detectamos alguns momentos de sobrecarga. Considere reduzir a complexidade da interface ou aumentar a frequência de pausas.',
      actionable: true,
      action: {
        label: 'Ajustar complexidade',
        type: 'adjust_complexity',
      },
      confidence: 0.75,
    });
  }

  if (report.summary.averageFocusScore > 75) {
    insights.push({
      id: `fb_${Date.now()}_3`,
      category: 'strategy',
      title: 'Momento de Flow Aproveitado',
      content: 'Seu foco está excelente. Este é um bom momento para tarefas complexas que exigem concentração profunda.',
      actionable: true,
      action: {
        label: 'Iniciar foco profundo',
        type: 'start_focus',
      },
      confidence: 0.8,
    });
  }

  return insights;
}

function generateFallbackCoaching(pattern: BehavioralPattern): string {
  const messages: Record<BehavioralPattern['patternType'], string> = {
    high_performer: 'Você está no topo do seu jogo! Mantenha este ritmo e celebre suas conquistas.',
    frequent_switcher: 'Percebemos que você alterna entre tarefas. Experimente focar em uma só por 15 minutos.',
    deep_diver: 'Sua capacidade de foco profundo é incrível. Lembre-se de pausas para sustentar isso.',
    bursty_worker: 'Seu ritmo oscila, e isso é normal. Tente identificar seus horários de pico.',
    consistency_king: 'Sua consistência é admirável. Manter rotina é seu superpoder!',
  };

  return messages[pattern.patternType] || 'Continue assim, você está fazendo um ótimo trabalho!';
}

export async function generateDailySummary(
  report: DailyCognitiveReport
): Promise<string> {
  const messages = [
    {
      role: 'user' as const,
      content: `Crie um resumo empático e motivador do dia:

Foco total: ${report.summary.totalFocusTime} minutos
Tarefas: ${report.summary.tasksCompleted}
Score médio: ${report.summary.averageFocusScore}
Tendência: ${report.trend}

Máximo 3 frases, tom amigável, em português.`,
    },
  ];

  try {
    return await generateText({ messages });
  } catch {
    return `Hoje você focou por ${report.summary.totalFocusTime} minutos e completou ${report.summary.tasksCompleted} tarefas. ${report.trend === 'improving' ? 'Seu desempenho está melhorando!' : 'Amanhã é um novo dia para continuar evoluindo.'}`;
  }
}
