export interface InteractionEvent {
  id: string;
  timestamp: number;
  type: 'screen_view' | 'task_switch' | 'scroll' | 'tap' | 'focus_start' | 'focus_end' | 'break_taken' | 'dismiss' | 'complete';
  metadata?: Record<string, unknown>;
}

export interface CognitiveMetricsSnapshot {
  timestamp: number;
  focusScore: number;
  overloadIndex: number;
  sessionDuration: number;
  taskSwitchRate: number;
  averageFocusDuration: number;
  interruptionCount: number;
  flowStateScore: number;
}

export interface BehavioralPattern {
  id: string;
  patternType: 'high_performer' | 'frequent_switcher' | 'deep_diver' | 'bursty_worker' | 'consistency_king';
  confidence: number;
  detectedAt: number;
  supportingEvidence: string[];
}

export interface OverloadPrediction {
  probability: number;
  estimatedTimeToOverload: number;
  contributingFactors: string[];
  recommendedAction: 'break_now' | 'reduce_complexity' | 'extend_session' | 'maintain';
  urgency: 'low' | 'medium' | 'high' | 'critical';
}

export interface AdaptiveSuggestion {
  id: string;
  type: 'break' | 'complexity_adjust' | 'task_reorder' | 'focus_technique' | 'environment';
  title: string;
  description: string;
  priority: number;
  expiresAt: number;
  action?: () => void;
}

export interface FocusSessionAnalysis {
  sessionId: string;
  startTime: number;
  endTime: number;
  durationMinutes: number;
  focusScore: number;
  peakFocusTime: number;
  attentionDrops: Array<{ timestamp: number; severity: number }>;
  flowStates: Array<{ start: number; end: number; quality: number }>;
  productivityScore: number;
}

export interface DailyCognitiveReport {
  date: string;
  summary: {
    totalFocusTime: number;
    averageFocusScore: number;
    overloadEvents: number;
    breaksTaken: number;
    tasksCompleted: number;
  };
  patterns: BehavioralPattern[];
  insights: string[];
  recommendations: AdaptiveSuggestion[];
  trend: 'improving' | 'stable' | 'declining';
}

export interface ComplexityAdjustment {
  currentLevel: 1 | 2 | 3;
  suggestedLevel: 1 | 2 | 3;
  reason: string;
  confidence: number;
  triggers: string[];
}

export interface AIConfiguration {
  enabled: boolean;
  privacyMode: 'local_only' | 'hybrid' | 'cloud_enhanced';
  analysisFrequency: 'realtime' | 'periodic' | 'on_demand';
  retentionDays: number;
  anonymizationEnabled: boolean;
}
