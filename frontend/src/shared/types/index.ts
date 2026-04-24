// ── Auth ──────────────────────────────────────────────────────────────────────
export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: 'client' | 'developer';
}

// ── Chat ──────────────────────────────────────────────────────────────────────
export type MessageRole = 'client' | 'developer' | 'ai' | 'system';

export interface Attachment {
  id: string;
  name: string;
  size: number;
  type: string; // mime type
  url?: string;  // object URL or remote URL
  file?: File;
}

export interface Message {
  id: string;
  chatId: string;
  authorId: string;
  role: MessageRole;
  content: string;
  attachments?: Attachment[];
  timestamp: Date;
  isStreaming?: boolean;
}

export interface ChatRoom {
  id: string;
  title: string;
  inviteCode?: string;
  participants: User[];
  messages: Message[];
  createdAt: Date;
  lastMessageAt: Date;
  aiAnalysis?: AiAnalysis;
}

// ── AI Analysis (sidebar) ─────────────────────────────────────────────────────
export interface AiIssue {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  suggestion: string;
}

export interface AiAnalysis {
  summary: string;
  score: number;
  issues: AiIssue[];
  generatedAt: Date;
}

// ── App state ─────────────────────────────────────────────────────────────────
export type AppRoute = 'home' | 'login' | 'register' | 'chat';
