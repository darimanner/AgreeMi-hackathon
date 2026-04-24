import { create } from 'zustand';
import type { AppState, ParsedDocument, ChatMessage, KanbanTask, Issue } from '../shared/types';

// ── Mock data ──────────────────────────────────────────────
const MOCK_TEXT = `1. The system must work fast and reliably.

2. Users must be able to upload files.

3. The button should be blue or green — whichever looks better.

4. The system must handle all possible errors.

5. Authentication must be as secure as possible.

6. The interface must be intuitive and modern.

7. Data must be stored in a database and updated in real time.

8. Notifications must be sent instantly for any events.

9. The system must support an unlimited number of users.

10. Reports must be generated quickly.`;

const MOCK_ISSUES = [
  {
    id: 'i1',
    startIndex: 25,
    endIndex: 46,
    text: 'fast and reliably',
    level: 'critical' as const,
    title: 'Non-measurable requirement',
    description: 'The words "fast" and "reliably" have no concrete metrics. There is no way to verify this requirement is met.',
    suggestion: 'Specify exact values: "response time ≤ 200 ms at 1,000 RPS; uptime ≥ 99.9%".',
  },
  {
    id: 'i2',
    startIndex: 140,
    endIndex: 170,
    text: 'blue or green — whichever looks better',
    level: 'critical' as const,
    title: 'Ambiguous requirement',
    description: 'The requirement defers the decision to implementation time, causing disagreements between designer and stakeholder.',
    suggestion: 'Pin the exact colour in design tokens: "button uses primary-500 from the brand palette".',
  },
  {
    id: 'i3',
    startIndex: 200,
    endIndex: 221,
    text: 'all possible errors',
    level: 'warning' as const,
    title: 'Unrealistic scope',
    description: '"All possible errors" is scope creep. It is impossible to cover every case without an explicit enumeration.',
    suggestion: 'List concrete error classes: network timeouts, 4xx/5xx HTTP codes, invalid input.',
  },
  {
    id: 'i4',
    startIndex: 251,
    endIndex: 270,
    text: 'as secure as possible',
    level: 'warning' as const,
    title: 'Non-verifiable requirement',
    description: '"As secure as possible" is a subjective assessment. No compliance standard is referenced.',
    suggestion: 'Cite a standard: "OWASP ASVS Level 2 compliant, MFA required, bcrypt cost=12".',
  },
  {
    id: 'i5',
    startIndex: 389,
    endIndex: 413,
    text: 'an unlimited number of users',
    level: 'critical' as const,
    title: 'Infinite scaling fallacy',
    description: 'Unlimited scale is technically and financially impossible. The requirement misleads the engineering team.',
    suggestion: 'Define realistic load: "support up to 50,000 concurrent users with horizontal scaling".',
  },
  {
    id: 'i6',
    startIndex: 452,
    endIndex: 459,
    text: 'quickly',
    level: 'warning' as const,
    title: 'Missing performance metric',
    description: 'Recurring pattern: "quickly" without any SLA.',
    suggestion: 'Report generation time ≤ 3 seconds for datasets up to 100,000 rows.',
  },
];

const MOCK_KANBAN: KanbanTask[] = [
  { id: 'k1', title: 'Define SLA for API endpoints', description: 'Document p95/p99 latency and uptime SLO in an ADR', priority: 'high', estimate: '2d', tags: ['backend', 'architecture'], column: 'todo' },
  { id: 'k2', title: 'Build button UI kit', description: 'Create design tokens and a Button component in Storybook', priority: 'medium', estimate: '3d', tags: ['frontend', 'design'], column: 'todo' },
  { id: 'k3', title: 'Error handling specification', description: 'Write an error matrix: HTTP codes, user-facing messages, alerts', priority: 'high', estimate: '1d', tags: ['backend', 'docs'], column: 'backlog' },
  { id: 'k4', title: 'Security audit checklist', description: 'OWASP ASVS L2 review, pen-test scope, MFA flow diagram', priority: 'high', estimate: '5d', tags: ['security', 'backend'], column: 'backlog' },
  { id: 'k5', title: 'Load testing plan', description: 'k6 scenarios for 50k concurrent users, baseline metrics', priority: 'medium', estimate: '3d', tags: ['devops', 'testing'], column: 'backlog' },
  { id: 'k6', title: 'File storage setup', description: 'S3-compatible storage, retention policies, CDN config', priority: 'medium', estimate: '2d', tags: ['backend', 'infra'], column: 'in-progress' },
  { id: 'k7', title: 'Requirements workshop with client', description: 'Workshop to clarify ambiguous items in the spec (req. 3, 5, 9)', priority: 'high', estimate: '1d', tags: ['management'], column: 'done' },
  { id: 'k8', title: 'Auth wireframes', description: 'Login / Register / MFA screens in Figma', priority: 'low', estimate: '2d', tags: ['design', 'frontend'], column: 'in-progress' },
];

const MOCK_CHAT: ChatMessage[] = [
  {
    id: 'c0',
    role: 'assistant',
    content: '👋 Document loaded and analysed. Found **6 issues** in the requirements: 3 critical, 3 warnings.\n\nClick any highlighted passage in the document on the left — I will explain the problem in detail. Or ask me anything directly.',
    timestamp: new Date(Date.now() - 60000),
  },
];

// ── Store ──────────────────────────────────────────────────
interface AppStore {
  appState: AppState;
  document: ParsedDocument | null;
  chatMessages: ChatMessage[];
  selectedIssue: Issue | null;
  kanbanTasks: KanbanTask[];
  isStreaming: boolean;
  uploadProgress: number;

  setAppState: (state: AppState) => void;
  uploadDocument: (file: File) => Promise<void>;
  selectIssue: (issue: Issue | null) => void;
  sendMessage: (content: string) => Promise<void>;
  generateRoadmap: () => Promise<void>;
  updateTaskColumn: (taskId: string, column: KanbanTask['column']) => void;
}

export const useAppStore = create<AppStore>((set) => ({
  appState: 'upload',
  document: null,
  chatMessages: [...MOCK_CHAT],
  selectedIssue: null,
  kanbanTasks: MOCK_KANBAN,
  isStreaming: false,
  uploadProgress: 0,

  setAppState: (state) => set({ appState: state }),

  uploadDocument: async () => {
    set({ appState: 'analyzing', uploadProgress: 0 });

    // Simulate progress
    for (let i = 0; i <= 100; i += Math.floor(Math.random() * 15) + 5) {
      await new Promise(r => setTimeout(r, 120));
      set({ uploadProgress: Math.min(i, 100) });
    }
    await new Promise(r => setTimeout(r, 400));

    const doc: ParsedDocument = {
      rawText: MOCK_TEXT,
      sections: [],
      issues: MOCK_ISSUES,
      score: 34,
      stats: {
        totalRequirements: 10,
        criticalIssues: 3,
        warnings: 3,
        suggestions: 2,
      },
    };

    set({ document: doc, appState: 'review', uploadProgress: 100 });
  },

  selectIssue: (issue) => {
    set({ selectedIssue: issue });
    if (!issue) return;

    // Auto-send analysis to chat
    const msg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: `Explain the issue: "${issue.text}"`,
      timestamp: new Date(),
      relatedIssueId: issue.id,
    };
    set(s => ({ chatMessages: [...s.chatMessages, msg] }));

    // Stream response
    setTimeout(() => {
      const response: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `**${issue.title}**\n\n${issue.description}\n\n💡 **Recommendation:**\n${issue.suggestion}`,
        timestamp: new Date(),
        relatedIssueId: issue.id,
        isStreaming: false,
      };
      set(s => ({ chatMessages: [...s.chatMessages, response] }));
    }, 800);
  },

  sendMessage: async (content: string) => {
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date(),
    };
    set(s => ({ chatMessages: [...s.chatMessages, userMsg], isStreaming: true }));

    await new Promise(r => setTimeout(r, 1200));

    const responses = [
      'Good question. Based on the document analysis: this requirement needs to be refined with concrete metrics and acceptance criteria.',
      'I recommend applying the **SMART** template: Specific, Measurable, Achievable, Relevant, Time-bound. This will eliminate most of the identified issues.',
      'A common mistake in specs is the absence of a **Definition of Done**. Make sure every requirement has a verifiable acceptance criterion.',
    ];

    const aiMsg: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: responses[Math.floor(Math.random() * responses.length)],
      timestamp: new Date(),
    };
    set(s => ({ chatMessages: [...s.chatMessages, aiMsg], isStreaming: false }));
  },

  generateRoadmap: async () => {
    set({ appState: 'roadmap' });
  },

  updateTaskColumn: (taskId, column) => {
    set(s => ({
      kanbanTasks: s.kanbanTasks.map(t => t.id === taskId ? { ...t, column } : t),
    }));
  },
}));
