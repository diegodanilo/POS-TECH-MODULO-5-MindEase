import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import { Platform } from 'react-native';

interface ParsedTask {
  title: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high';
  estimatedMinutes?: number;
  cognitiveLoad?: 'low' | 'medium' | 'high';
  tags?: string[];
}

interface VoiceCommand {
  type: 'create_task' | 'start_focus' | 'take_break' | 'show_tasks' | 'unknown';
  confidence: number;
  data?: ParsedTask | { duration?: number };
  rawText: string;
}

export class VoiceRecognitionService {
  private isListening = false;
  private recording: Audio.Recording | null = null;
  private onResultCallback: ((command: VoiceCommand) => void) | null = null;
  private onErrorCallback: ((error: Error) => void) | null = null;

  async requestPermissions(): Promise<boolean> {
    if (Platform.OS === 'web') return true;

    try {
      const { status: audioStatus } = await Audio.requestPermissionsAsync();
      return audioStatus === 'granted';
    } catch {
      return false;
    }
  }

  async startListening(
    onResult: (command: VoiceCommand) => void,
    onError: (error: Error) => void
  ): Promise<void> {
    if (this.isListening) return;

    this.onResultCallback = onResult;
    this.onErrorCallback = onError;

    const hasPermission = await this.requestPermissions();
    if (!hasPermission) {
      onError(new Error('Permissão de áudio negada'));
      return;
    }

    this.isListening = true;

    if (Platform.OS === 'web') {
      this.startWebListening();
    } else {
      void this.startNativeListening();
    }
  }

  private startWebListening(): void {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      this.onErrorCallback?.(new Error('Reconhecimento de voz não suportado neste navegador'));
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.lang = 'pt-BR';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      const command = this.parseCommand(transcript);
      this.onResultCallback?.(command);
      this.isListening = false;
    };

    recognition.onerror = (event: any) => {
      this.onErrorCallback?.(new Error(`Erro de reconhecimento: ${event.error}`));
      this.isListening = false;
    };

    recognition.onend = () => {
      this.isListening = false;
    };

    recognition.start();
  }

  private async startNativeListening(): Promise<void> {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      this.recording = recording;

      setTimeout(async () => {
        await this.stopListening();
        const command: VoiceCommand = {
          type: 'unknown',
          confidence: 0,
          rawText: 'Simulação de áudio capturado',
        };
        this.onResultCallback?.(command);
      }, 5000);
    } catch (error) {
      this.onErrorCallback?.(error as Error);
      this.isListening = false;
    }
  }

  async stopListening(): Promise<void> {
    if (!this.isListening) return;

    this.isListening = false;

    if (this.recording) {
      try {
        await this.recording.stopAndUnloadAsync();
        this.recording = null;
      } catch (error) {
        console.warn('Erro ao parar gravação:', error);
      }
    }
  }

  parseCommand(text: string): VoiceCommand {
    const normalizedText = text.toLowerCase().trim();

    const commandPatterns = [
      { pattern: /criar tarefa|nova tarefa|adicionar tarefa/, type: 'create_task' as const },
      { pattern: /começar foco|iniciar foco|modo foco/, type: 'start_focus' as const },
      { pattern: /pausa|descansar|intervalo/, type: 'take_break' as const },
      { pattern: /mostrar tarefas|ver tarefas|listar tarefas/, type: 'show_tasks' as const },
    ];

    let detectedType: VoiceCommand['type'] = 'unknown';
    let confidence = 0;

    for (const { pattern, type } of commandPatterns) {
      if (pattern.test(normalizedText)) {
        detectedType = type;
        confidence = 0.8;
        break;
      }
    }

    if (detectedType === 'create_task') {
      const taskData = this.extractTaskData(normalizedText);
      return {
        type: detectedType,
        confidence: 0.85,
        data: taskData,
        rawText: text,
      };
    }

    if (detectedType === 'start_focus') {
      const durationMatch = normalizedText.match(/(\d+)\s*(minuto|minutos|min)/);
      const duration = durationMatch ? parseInt(durationMatch[1], 10) : undefined;
      return {
        type: detectedType,
        confidence: 0.9,
        data: { duration },
        rawText: text,
      };
    }

    return {
      type: detectedType,
      confidence,
      rawText: text,
    };
  }

  private extractTaskData(text: string): ParsedTask {
    const priorityPatterns = [
      { pattern: /(urgente|importante|alta prioridade|prioridade alta)/, priority: 'high' as const },
      { pattern: /(média prioridade|prioridade média|normal)/, priority: 'medium' as const },
      { pattern: /(baixa prioridade|prioridade baixa|depois|quando der)/, priority: 'low' as const },
    ];

    const durationPatterns = [
      { pattern: /(\d+)\s*(minuto|minutos|min)/, multiplier: 1 },
      { pattern: /(\d+)\s*(hora|horas|h)/, multiplier: 60 },
      { pattern: /meia hora/, value: 30 },
      { pattern: /uma hora/, value: 60 },
      { pattern: /duas horas/, value: 120 },
    ];

    const complexityPatterns = [
      { pattern: /(simples|fácil|rápido)/, load: 'low' as const },
      { pattern: /(complexo|difícil|trabalhoso)/, load: 'high' as const },
    ];

    let priority: ParsedTask['priority'] = 'medium';
    for (const { pattern, priority: p } of priorityPatterns) {
      if (pattern.test(text)) {
        priority = p;
        break;
      }
    }

    let estimatedMinutes: number | undefined;
    for (const pattern of durationPatterns) {
      if ('value' in pattern) {
        if (pattern.pattern.test(text)) {
          estimatedMinutes = pattern.value;
          break;
        }
      } else {
        const match = text.match(pattern.pattern);
        if (match) {
          estimatedMinutes = parseInt(match[1], 10) * pattern.multiplier;
          break;
        }
      }
    }

    let cognitiveLoad: ParsedTask['cognitiveLoad'] = 'medium';
    for (const { pattern, load } of complexityPatterns) {
      if (pattern.test(text)) {
        cognitiveLoad = load;
        break;
      }
    }

    const cleanText = text
      .replace(/criar tarefa|nova tarefa|adicionar tarefa/gi, '')
      .replace(/urgente|importante|prioridade (alta|média|baixa)/gi, '')
      .replace(/\d+\s*(minuto|minutos|min|hora|horas|h)/gi, '')
      .replace(/simples|fácil|complexo|difícil/gi, '')
      .trim();

    const words = cleanText.split(' ').filter(w => w.length > 0);
    const title = words.slice(0, 6).join(' ') || 'Nova Tarefa';
    const description = words.length > 6 ? words.slice(6).join(' ') : undefined;

    return {
      title: title.charAt(0).toUpperCase() + title.slice(1),
      description,
      priority,
      estimatedMinutes,
      cognitiveLoad,
    };
  }

  speak(text: string, options?: Speech.SpeechOptions): void {
    void Speech.stop();
    Speech.speak(text, {
      language: 'pt-BR',
      pitch: 1,
      rate: 0.9,
      ...options,
    });
  }

  stopSpeaking(): void {
    void Speech.stop();
  }

  getListeningState(): boolean {
    return this.isListening;
  }
}

export const voiceRecognition = new VoiceRecognitionService();
