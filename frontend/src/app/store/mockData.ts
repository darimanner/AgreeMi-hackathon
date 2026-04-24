import type { AiAnalysis, ChatRoom, User } from '../../shared/types';

export const MOCK_DEV: User = {
  id: 'dev-1',
  name: 'Alex Dev',
  email: 'alex@devteam.io',
  role: 'developer',
};

export const MOCK_CLIENT: User = {
  id: 'client-1',
  name: 'Sarah Client',
  email: 'sarah@company.com',
  role: 'client',
};

export const MOCK_AI_ANALYSIS: AiAnalysis = {
  summary: 'The uploaded specification has several ambiguous requirements that may cause misunderstandings. Overall quality is moderate.',
  score: 62,
  issues: [
    {
      id: 'a1',
      severity: 'critical',
      title: 'No deadline specified',
      description: 'The project timeline is completely absent from the specification document.',
      suggestion: 'Add explicit milestone dates and a delivery deadline.',
    },
    {
      id: 'a2',
      severity: 'warning',
      title: 'Vague performance requirements',
      description: '"The app should be fast" is not a measurable requirement.',
      suggestion: 'Define SLA: e.g. "API response time <= 200ms at p95".',
    },
    {
      id: 'a3',
      severity: 'info',
      title: 'Missing error handling spec',
      description: 'There is no mention of how the system should handle failures.',
      suggestion: 'Document error codes, user-facing messages, and retry policies.',
    },
  ],
  generatedAt: new Date(Date.now() - 3600000),
};

export const MOCK_CHATS: ChatRoom[] = [
  {
    id: 'chat-1',
    title: 'E-Commerce Platform MVP',
    participants: [MOCK_CLIENT, MOCK_DEV],
    createdAt: new Date(Date.now() - 86400000 * 2),
    lastMessageAt: new Date(Date.now() - 1800000),
    aiAnalysis: MOCK_AI_ANALYSIS,
    messages: [
      {
        id: 'm1',
        chatId: 'chat-1',
        authorId: 'client-1',
        role: 'client',
        content: 'Hi! I\'ve uploaded our project spec. Can you review it?',
        timestamp: new Date(Date.now() - 86400000),
      },
      {
        id: 'm2',
        chatId: 'chat-1',
        authorId: 'dev-1',
        role: 'developer',
        content: 'Sure! I\'ll check it right now. Give me a few minutes.',
        timestamp: new Date(Date.now() - 86400000 + 60000),
      },
      {
        id: 'm3',
        chatId: 'chat-1',
        authorId: 'ai',
        role: 'ai',
        content: '🤖 **AI Analysis complete.** I found 3 issues in the specification. Check the sidebar for details.',
        timestamp: new Date(Date.now() - 86400000 + 120000),
      },
      {
        id: 'm4',
        chatId: 'chat-1',
        authorId: 'dev-1',
        role: 'developer',
        content: 'The AI flagged some performance requirements as too vague. Let\'s discuss what SLAs you need.',
        timestamp: new Date(Date.now() - 1800000),
      },
    ],
  },
  {
    id: 'chat-2',
    title: 'Mobile App Redesign',
    participants: [MOCK_CLIENT, MOCK_DEV],
    createdAt: new Date(Date.now() - 86400000 * 5),
    lastMessageAt: new Date(Date.now() - 7200000),
    messages: [
      {
        id: 'm5',
        chatId: 'chat-2',
        authorId: 'client-1',
        role: 'client',
        content: 'Let\'s kick off the redesign project here.',
        timestamp: new Date(Date.now() - 7200000),
      },
    ],
  },
];
