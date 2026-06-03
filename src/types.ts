export interface MistakeDetail {
  id: string;
  original: string;
  corrected: string;
  explanation: string;
  category: 'grammar' | 'vocabulary' | 'pronunciation' | 'structural' | 'spelling';
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
  // If role is assistant, it could have evaluation for the user's PRECEDING utterance
  evaluation?: {
    hasMistakes: boolean;
    mistakes: MistakeDetail[];
    fluencyTip: string;
    generalComment: string;
  };
  audioUrl?: string;
}

export interface VoiceConfig {
  gender: 'male' | 'female';
  voiceName: string;
  accent: string;
}

export interface TrainingSession {
  id: string;
  topic: string;
  voiceConfig: VoiceConfig;
  targetDurationMinutes: number;
  elapsedSeconds: number;
  isActive: boolean;
  messages: Message[];
  score: number; // calculated engagement/fluency rating out of 100
}
