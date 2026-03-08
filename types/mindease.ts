export type CognitiveComplexity = 1 | 2 | 3;

export type CognitiveCondition =
  | 'adhd'
  | 'asd'
  | 'dyslexia'
  | 'burnout'
  | 'anxiety'
  | 'sensory_overload'
  | 'retention_difficulty';

export interface CognitiveProfile {
  name: string;
  complexity: CognitiveComplexity;
  conditions: CognitiveCondition[];
  focusGoalMinutes: number;
  breakIntervalMinutes: number;
  reducedMotion: boolean;
  highContrast: boolean;
  onboardingComplete: boolean;
}

export interface CognitiveState {
  focusScore: number;
  overloadIndex: number;
  sessionStartTime: number;
  sessionDurationMinutes: number;
  taskSwitchCount: number;
  lastActiveTimestamp: number;
  isInFocusMode: boolean;
  shouldSuggestBreak: boolean;
  currentStreak: number;
}

export type TaskCognitiveLoad = 'low' | 'medium' | 'high';
export type TaskStatus = 'pending' | 'in_progress' | 'completed';

export interface Task {
  id: string;
  title: string;
  description: string;
  cognitiveLoad: TaskCognitiveLoad;
  status: TaskStatus;
  estimatedMinutes: number;
  createdAt: number;
  completedAt?: number;
  tags: string[];
}

export interface DailyMetrics {
  date: string;
  totalFocusMinutes: number;
  tasksCompleted: number;
  averageFocusScore: number;
  overloadEvents: number;
  breaksTaken: number;
}

export interface CognitiveTokens {
  spacing: {
    base: number;
    card: number;
    section: number;
  };
  fontSize: {
    body: number;
    heading: number;
    subheading: number;
    caption: number;
  };
  borderRadius: number;
  maxItemsVisible: number;
  animationDuration: number;
  lineHeight: number;
  cardElevation: number;
}
