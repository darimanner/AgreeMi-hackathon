export type IssueLevel = 'critical' | 'warning' | 'info';

export interface Issue {
  id: string;
  startIndex: number;
  endIndex: number;
  text: string;
  level: IssueLevel;
  title: string;
  description: string;
  suggestion: string;
}

export interface ParsedDocument {
  rawText: string;
  sections: Section[];
  issues: Issue[];
  score: number; // 0-100
  stats: {
    totalRequirements: number;
    criticalIssues: number;
    warnings: number;
    suggestions: number;
  };
}

export interface Section {
  id: string;
  title: string;
  content: string;
  issues: Issue[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  relatedIssueId?: string;
  isStreaming?: boolean;
}

export interface KanbanTask {
  id: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  estimate: string;
  tags: string[];
  column: KanbanColumn;
}

export type KanbanColumn = 'backlog' | 'todo' | 'in-progress' | 'done';

export type AppState = 'upload' | 'analyzing' | 'review' | 'roadmap';
