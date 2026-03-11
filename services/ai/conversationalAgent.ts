import AsyncStorage from '@react-native-async-storage/async-storage';
import { focusPrediction } from './focusPrediction';
import { habitLearning } from './habitLearning';
import { sentimentAnalyzer } from './sentimentAnalysis';
import { wearableService } from './wearableIntegration';

interface AgentContext {
  userName: string;
  currentStressLevel: number;
  currentFocusScore: number;
  pendingTasksCount: number;
  lastBreakTime: number;
  todaysFocusSessions: number;
  cognitiveProfile: {
    complexity: number;
    conditions: string[];
  };
}

interface AgentResponse {
  text: string;
  actions?: Array<{
    type: 'start_focus' | 'take_break' | 'show_tasks' | 'adjust_complexity' | 'suggest_technique' | 'schedule_request';
    payload?: unknown;
  }>;
  emotion?: 'supportive' | 'encouraging' | 'concerned' | 'neutral';
  followUpQuestion?: string;
}

interface Conversation {
  id: string;
  timestamp: number;
  userMessage: string;
  agentResponse: AgentResponse;
  context: AgentContext;
}

type Intent = 
  | 'greeting'
  | 'focus_request'
  | 'break_request'
  | 'task_query'
  | 'stress_expression'
  | 'productivity_query'
  | 'schedule_request'
  | 'technique_request'
  | 'wellness_check'
  | 'general_chat'
  | 'complexity_change'
  | 'unknown';

const CONVERSATION_HISTORY_KEY = 'mindease_conversations';

export class ConversationalAgent {
  private context: AgentContext | null = null;
  private conversationHistory: Conversation[] = [];
  private readonly maxHistorySize = 50;

  async initialize(userContext: AgentContext): Promise<void> {
    this.context = userContext;
    await this.loadConversationHistory();
  }

  private async loadConversationHistory(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(CONVERSATION_HISTORY_KEY);
      if (stored) {
        this.conversationHistory = JSON.parse(stored);
      }
    } catch (error) {
      console.warn('Failed to load conversation history:', error);
    }
  }

  private async saveConversationHistory(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        CONVERSATION_HISTORY_KEY,
        JSON.stringify(this.conversationHistory.slice(-this.maxHistorySize))
      );
    } catch (error) {
      console.warn('Failed to save conversation history:', error);
    }
  }

  async processMessage(userMessage: string): Promise<AgentResponse> {
    const intent = this.detectIntent(userMessage);
    const sentiment = sentimentAnalyzer.analyzeTask(userMessage);
    
    const response = await this.generateResponse(intent, userMessage, sentiment);
    
    const conversation: Conversation = {
      id: `conv_${Date.now()}`,
      timestamp: Date.now(),
      userMessage,
      agentResponse: response,
      context: this.context!,
    };

    this.conversationHistory.push(conversation);
    void this.saveConversationHistory();

    return response;
  }

  private detectIntent(message: string): Intent {
    const lowerMessage = message.toLowerCase();
    
    const intentPatterns: Record<Intent, RegExp[]> = {
      greeting: [/^(oi|olá|ola|hey|hi|e aí|como vai)/],
      focus_request: [/(focar|concentrar|começar sessão|modo foco|preciso trabalhar|vou estudar)/],
      break_request: [/(pausa|descanso|intervalo|preciso parar|cansado|cansada)/],
      task_query: [/(tarefas|o que tenho|pendências|lista|afazeres)/],
      stress_expression: [/(estressado|ansioso|sobrecarregado|não aguento|muito difícil)/],
      productivity_query: [/(produtividade|como estou indo|meu desempenho|estatísticas)/],
      schedule_request: [/(horário|quando|melhor hora|agenda|programar)/],
      technique_request: [/(técnica|método|como fazer|dica|sugestão)/],
      wellness_check: [/(como estou|meu bem-estar|saúde mental|me sinto)/],
      complexity_change: [/(simplificar|complexo|fácil|difícil|modo simples)/],
      general_chat: [/.*/],
      unknown: [],
    };

    for (const [intent, patterns] of Object.entries(intentPatterns)) {
      if (patterns.some(pattern => pattern.test(lowerMessage))) {
        return intent as Intent;
      }
    }

    return 'unknown';
  }

  private async generateResponse(
    intent: Intent,
    message: string,
    sentiment: ReturnType<typeof sentimentAnalyzer.analyzeTask>
  ): Promise<AgentResponse> {
    if (!this.context) {
      return {
        text: 'Olá! Estou aqui para ajudar. Como posso apoiar você hoje?',
        emotion: 'neutral',
      };
    }

    const ctx = this.context;
    const stressHigh = ctx.currentStressLevel > 60;
    const focusLow = ctx.currentFocusScore < 50;
    const needsBreak = Date.now() - ctx.lastBreakTime > 45 * 60 * 1000;

    switch (intent) {
      case 'greeting':
        return this.generateGreeting(ctx, stressHigh, focusLow);

      case 'focus_request':
        return this.generateFocusResponse(ctx, needsBreak);

      case 'break_request':
        return this.generateBreakResponse(ctx, sentiment);

      case 'task_query':
        return this.generateTaskQueryResponse(ctx);

      case 'stress_expression':
        return this.generateStressSupportResponse(ctx, sentiment);

      case 'productivity_query':
        return this.generateProductivityResponse(ctx);

      case 'schedule_request':
        return this.generateScheduleResponse();

      case 'technique_request':
        return this.generateTechniqueResponse(ctx);

      case 'wellness_check':
        return this.generateWellnessResponse(ctx);

      case 'complexity_change':
        return this.generateComplexityChangeResponse(message);

      case 'general_chat':
      default:
        return this.generateGeneralResponse(message, sentiment);
    }
  }

  private generateGreeting(ctx: AgentContext, stressHigh: boolean, focusLow: boolean): AgentResponse {
    const hour = new Date().getHours();
    const timeGreeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
    
    let text = `${timeGreeting}, ${ctx.userName}! `;
    
    if (stressHigh) {
      text += 'Percebi que você pode estar sob tensão. Que tal uma respiração rápida antes de começar?';
      return {
        text,
        emotion: 'concerned',
        actions: [{ type: 'suggest_technique', payload: { technique: 'breathing' } }],
      };
    }

    if (focusLow) {
      text += 'Seu foco parece um pouco baixo. Posso sugerir um horário melhor para trabalhar?';
      return {
        text,
        emotion: 'supportive',
        actions: [{ type: 'schedule_request' }],
      };
    }

    if (ctx.pendingTasksCount > 5) {
      text += `Você tem ${ctx.pendingTasksCount} tarefas pendentes. Quer que eu sugira por onde começar?`;
    } else if (ctx.todaysFocusSessions === 0) {
      text += 'Pronto para uma sessão de foco hoje?';
    } else {
      text += 'Como posso ajudar você hoje?';
    }

    return { text, emotion: 'encouraging' };
  }

  private generateFocusResponse(ctx: AgentContext, needsBreak: boolean): AgentResponse {
    if (needsBreak) {
      return {
        text: `Você está há ${Math.round((Date.now() - ctx.lastBreakTime) / 60000)} minutos sem pausa. Sugiro um descanso de 5 minutos antes de começar. Que tal?`,
        emotion: 'concerned',
        actions: [
          { type: 'take_break', payload: { duration: 5 } },
          { type: 'start_focus', payload: { duration: 25 } },
        ],
      };
    }

    const prediction = focusPrediction.predictOptimalFocusTime();
    const currentPotential = prediction.currentFocusPotential;

    if (currentPotential >= 70) {
      return {
        text: 'Excelente momento para foco! Suas condições cognitivas estão ótimas. Vou iniciar uma sessão de 25 minutos?',
        emotion: 'encouraging',
        actions: [{ type: 'start_focus', payload: { duration: 25 } }],
      };
    }

    if (prediction.nextOptimalTime) {
      const nextTime = prediction.nextOptimalTime;
      return {
        text: `Seu potencial de foco atual está em ${currentPotential}%. O próximo horário ótimo será às ${nextTime.getHours()}:${String(nextTime.getMinutes()).padStart(2, '0')}. Quer esperar ou começar uma sessão curta agora?`,
        emotion: 'supportive',
        actions: [
          { type: 'start_focus', payload: { duration: 15 } },
          { type: 'schedule_request' },
        ],
      };
    }

    return {
      text: 'Vamos começar! Iniciarei uma sessão de foco de 25 minutos para você.',
      emotion: 'encouraging',
      actions: [{ type: 'start_focus', payload: { duration: 25 } }],
    };
  }

  private generateBreakResponse(ctx: AgentContext, sentiment: ReturnType<typeof sentimentAnalyzer.analyzeTask>): AgentResponse {
    const breakDuration = ctx.currentStressLevel > 70 ? 10 : 5;
    
    let text = 'Ótima ideia fazer uma pausa!';
    
    if (sentiment.emotionalTone.anxiety > 50) {
      text += ' Percebo que você pode estar ansioso. Que tal uma respiração guiada durante o descanso?';
    } else if (ctx.currentStressLevel > 60) {
      text += ' Você está sob carga cognitiva. Aproveite para se hidratar e alongar.';
    }

    text += ` Sugiro ${breakDuration} minutos de pausa.`;

    return {
      text,
      emotion: 'supportive',
      actions: [{ type: 'take_break', payload: { duration: breakDuration } }],
    };
  }

  private generateTaskQueryResponse(ctx: AgentContext): AgentResponse {
    const count = ctx.pendingTasksCount;
    
    if (count === 0) {
      return {
        text: 'Você não tem tarefas pendentes! Aproveite para descansar ou adicionar novas metas.',
        emotion: 'encouraging',
      };
    }

    const priorityText = count > 5 
      ? `Você tem ${count} tarefas. Vamos priorizar as mais importantes?`
      : `Você tem ${count} tarefa${count > 1 ? 's' : ''} pendente. Pronto para começar?`;

    return {
      text: priorityText,
      emotion: 'supportive',
      actions: [{ type: 'show_tasks' }],
    };
  }

  private generateStressSupportResponse(
    _ctx: AgentContext,
    _sentiment: ReturnType<typeof sentimentAnalyzer.analyzeTask>
  ): AgentResponse {
    const wearableData = wearableService.analyzeCognitiveState();
    
    let text = 'Sinto muito que você esteja se sentindo assim. ';
    
    if (wearableData.stressLevel.level !== 'low') {
      text += `Seus sinais físicos indicam ${wearableData.stressLevel.level === 'critical' ? 'stress crítico' : 'stress elevado'}. `;
    }

    text += 'Vamos reduzir a complexidade da interface e fazer uma respiração juntos?';

    return {
      text,
      emotion: 'concerned',
      actions: [
        { type: 'adjust_complexity', payload: { level: 1 } },
        { type: 'suggest_technique', payload: { technique: 'breathing' } },
      ],
      followUpQuestion: 'Quer que eu te guie em uma respiração de 2 minutos?',
    };
  }

  private generateProductivityResponse(ctx: AgentContext): AgentResponse {
    const stats = focusPrediction.getSessionStats();
    const habit = habitLearning.getUserHabit();
    
    let text = `Hoje você completou ${ctx.todaysFocusSessions} sessão${ctx.todaysFocusSessions !== 1 ? 's' : ''} de foco. `;
    
    if (stats.totalSessions > 0) {
      text += `Sua média de qualidade é ${stats.averageQuality}%. `;
    }

    if (habit) {
      text += `Seu histórico mostra que você tem mais produtividade ${habit.productiveDays.length > 0 ? 'nos dias ' + habit.productiveDays.join(', ') : 'em certos dias'}.`;
    }

    return {
      text,
      emotion: 'encouraging',
    };
  }

  private generateScheduleResponse(): AgentResponse {
    const prediction = focusPrediction.predictOptimalFocusTime();
    const windows = prediction.optimalWindows;
    
    if (windows.length === 0) {
      return {
        text: 'Ainda estou aprendendo seus padrões. Horários típicos de produtividade são 9h-11h e 14h-16h.',
        emotion: 'neutral',
      };
    }

    const times = windows.slice(0, 2).map(w => {
      const date = new Date(w.start);
      return `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
    }).join(' e ');

    return {
      text: `Com base nos seus padrões, seus melhores horários de foco hoje são por volta de ${times}. Quer agendar uma sessão?`,
      emotion: 'supportive',
      actions: [{ type: 'schedule_request' }],
    };
  }

  private generateTechniqueResponse(ctx: AgentContext): AgentResponse {
    if (ctx.currentStressLevel > 60) {
      return {
        text: 'Para o momento atual, sugiro a Técnica 4-7-8 de respiração: inspire por 4s, segure por 7s, expire por 8s. Repita 4 vezes.',
        emotion: 'supportive',
        actions: [{ type: 'suggest_technique', payload: { technique: '4-7-8' } }],
      };
    }

    if (ctx.currentFocusScore < 50) {
      return {
        text: 'Tente o Método Pomodoro: 25 minutos de foco, 5 minutos de pausa. Isso ajuda a manter a concentração sem fadiga.',
        emotion: 'encouraging',
        actions: [{ type: 'start_focus', payload: { duration: 25, technique: 'pomodoro' } }],
      };
    }

    return {
      text: 'Que tal experimentar a Técnica de Two-Minute Rule? Se algo leva menos de 2 minutos, faça imediatamente. Ótimo para tarefas pequenas!',
      emotion: 'encouraging',
    };
  }

  private generateWellnessResponse(ctx: AgentContext): AgentResponse {
    const wearableData = wearableService.analyzeCognitiveState();
    
    let text = `Analisando seus sinais: `;
    text += `Readiness ${wearableData.readinessScore}%, `;
    text += `Recuperação física ${wearableData.physicalRecovery}%. `;
    
    if (wearableData.breakRecommended) {
      text += 'Seu corpo indica necessidade de pausa. ';
    }

    if (ctx.currentStressLevel > 50) {
      text += 'Sua carga cognitiva está elevada. Sugiro reduzir a complexidade das tarefas hoje.';
    } else {
      text += 'Você está em boas condições para produtividade!';
    }

    return {
      text,
      emotion: wearableData.breakRecommended ? 'concerned' : 'encouraging',
      actions: wearableData.breakRecommended ? [{ type: 'take_break' }] : undefined,
    };
  }

  private generateComplexityChangeResponse(message: string): AgentResponse {
    const wantSimpler = /(simplificar|mais fácil|simples|menos)/.test(message.toLowerCase());
    
    if (wantSimpler) {
      return {
        text: 'Entendido! Vou simplificar a interface para reduzir a carga cognitiva. Pronto?',
        emotion: 'supportive',
        actions: [{ type: 'adjust_complexity', payload: { level: 1 } }],
      };
    }

    return {
      text: 'Posso ajustar a complexidade da interface. Quer o modo simples, equilibrado ou completo?',
      emotion: 'neutral',
      actions: [
        { type: 'adjust_complexity', payload: { level: 1 } },
        { type: 'adjust_complexity', payload: { level: 2 } },
        { type: 'adjust_complexity', payload: { level: 3 } },
      ],
    };
  }

  private generateGeneralResponse(
    message: string,
    sentiment: ReturnType<typeof sentimentAnalyzer.analyzeTask>
  ): AgentResponse {
    if (sentiment.emotionalTone.frustration > 50) {
      return {
        text: 'Percebo que você pode estar frustrado. Estou aqui para ajudar. O que está acontecendo?',
        emotion: 'concerned',
      };
    }

    if (sentiment.emotionalTone.confidence > 60) {
      return {
        text: 'Adoro ver essa confiança! Como posso apoiar seus planos hoje?',
        emotion: 'encouraging',
      };
    }

    return {
      text: 'Entendi. Posso ajudar com foco, tarefas, ou sugerir técnicas. O que prefere?',
      emotion: 'neutral',
    };
  }

  updateContext(newContext: Partial<AgentContext>): void {
    if (this.context) {
      this.context = { ...this.context, ...newContext };
    }
  }

  getConversationHistory(): Conversation[] {
    return this.conversationHistory;
  }

  clearHistory(): void {
    this.conversationHistory = [];
    void AsyncStorage.removeItem(CONVERSATION_HISTORY_KEY);
  }
}

export const conversationalAgent = new ConversationalAgent();
