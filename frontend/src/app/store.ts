import { create } from 'zustand';
import type { AppState, ParsedDocument, ChatMessage, KanbanTask, Issue } from '../shared/types';

// ── Mock data ──────────────────────────────────────────────
const MOCK_TEXT = `1. Система должна работать быстро и надежно.

2. Пользователь должен иметь возможность загружать файлы.

3. Кнопка должна быть синей или зеленой — как будет лучше.

4. Система должна обрабатывать все возможные ошибки.

5. Авторизация должна быть максимально безопасной.

6. Интерфейс должен быть удобным и современным.

7. Данные должны храниться в базе данных и обновляться в реальном времени.

8. Нотификации должны отправляться мгновенно при любых событиях.

9. Система должна поддерживать неограниченное количество пользователей.

10. Отчёты должны формироваться быстро.`;

const MOCK_ISSUES = [
  {
    id: 'i1',
    startIndex: 25,
    endIndex: 43,
    text: 'быстро и надежно',
    level: 'critical' as const,
    title: 'Неизмеримое требование',
    description: 'Слова «быстро» и «надёжно» не имеют конкретных метрик. Невозможно верифицировать выполнение требования.',
    suggestion: 'Укажите конкретные значения: «время ответа ≤ 200мс при нагрузке 1000 RPS; uptime ≥ 99.9%».',
  },
  {
    id: 'i2',
    startIndex: 152,
    endIndex: 183,
    text: 'синей или зеленой — как будет лучше',
    level: 'critical' as const,
    title: 'Ambiguous requirement',
    description: 'Требование содержит неоднозначность: решение откладывается на этап реализации. Это приведёт к разногласиям между дизайнером и заказчиком.',
    suggestion: 'Зафиксируйте конкретный цвет в токенах дизайн-системы: «кнопка использует primary-500 из brand-palette».',
  },
  {
    id: 'i3',
    startIndex: 204,
    endIndex: 235,
    text: 'обрабатывать все возможные ошибки',
    level: 'warning' as const,
    title: 'Нереалистичный охват',
    description: '«Все возможные ошибки» — scope creep. Невозможно покрыть все кейсы без конкретного перечня.',
    suggestion: 'Перечислите конкретные классы ошибок: сетевые тайм-ауты, 4xx/5xx HTTP, невалидный ввод.',
  },
  {
    id: 'i4',
    startIndex: 259,
    endIndex: 283,
    text: 'максимально безопасной',
    level: 'warning' as const,
    title: 'Неверифицируемое требование',
    description: '«Максимально безопасной» — субъективная оценка. Отсутствует стандарт соответствия.',
    suggestion: 'Укажите стандарт: «соответствие OWASP ASVS Level 2, MFA обязателен, bcrypt с cost=12».',
  },
  {
    id: 'i5',
    startIndex: 425,
    endIndex: 463,
    text: 'неограниченное количество пользователей',
    level: 'critical' as const,
    title: 'Infinite scaling fallacy',
    description: 'Неограниченный масштаб технически и финансово невозможен. Требование вводит в заблуждение команду.',
    suggestion: 'Определите реальную нагрузку: «система должна поддерживать до 50 000 активных пользователей одновременно с горизонтальным масштабированием».',
  },
  {
    id: 'i6',
    startIndex: 486,
    endIndex: 492,
    text: 'быстро',
    level: 'warning' as const,
    title: 'Нет метрики производительности',
    description: 'Повторяющийся паттерн: «быстро» без SLA.',
    suggestion: 'Время генерации отчёта ≤ 3 секунды для датасетов до 100 000 строк.',
  },
];

const MOCK_KANBAN: KanbanTask[] = [
  { id: 'k1', title: 'Определить SLA для API endpoints', description: 'Зафиксировать p95/p99 latency и uptime SLO в ADR', priority: 'high', estimate: '2д', tags: ['backend', 'architecture'], column: 'todo' },
  { id: 'k2', title: 'Разработать UI kit кнопок', description: 'Создать дизайн-токены и компонент Button в Storybook', priority: 'medium', estimate: '3д', tags: ['frontend', 'design'], column: 'todo' },
  { id: 'k3', title: 'Спецификация обработки ошибок', description: 'Составить матрицу ошибок: HTTP коды, пользовательские сообщения, алерты', priority: 'high', estimate: '1д', tags: ['backend', 'docs'], column: 'backlog' },
  { id: 'k4', title: 'Security audit checklist', description: 'OWASP ASVS L2 review, pen-test scope, MFA flow diagram', priority: 'high', estimate: '5д', tags: ['security', 'backend'], column: 'backlog' },
  { id: 'k5', title: 'Load testing план', description: 'k6 сценарии для 50k concurrent users, baseline метрики', priority: 'medium', estimate: '3д', tags: ['devops', 'testing'], column: 'backlog' },
  { id: 'k6', title: 'Настройка файлового хранилища', description: 'S3-compatible storage, политики retention, CDN конфиг', priority: 'medium', estimate: '2д', tags: ['backend', 'infra'], column: 'in-progress' },
  { id: 'k7', title: 'Уточнение требований с заказчиком', description: 'Воркшоп по неоднозначным пунктам ТЗ (п. 3, 5, 9)', priority: 'high', estimate: '1д', tags: ['management'], column: 'done' },
  { id: 'k8', title: 'Wireframes авторизации', description: 'Login/Register/MFA screens в Figma', priority: 'low', estimate: '2д', tags: ['design', 'frontend'], column: 'in-progress' },
];

const MOCK_CHAT: ChatMessage[] = [
  {
    id: 'c0',
    role: 'assistant',
    content: '👋 Документ загружен и проанализирован. Найдено **6 проблем** в требованиях: 3 критических, 3 предупреждения.\n\nКликните на любое выделенное место в тексте слева — я объясню проблему подробно. Или задайте вопрос напрямую.',
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

export const useAppStore = create<AppStore>((set, get) => ({
  appState: 'upload',
  document: null,
  chatMessages: [...MOCK_CHAT],
  selectedIssue: null,
  kanbanTasks: MOCK_KANBAN,
  isStreaming: false,
  uploadProgress: 0,

  setAppState: (state) => set({ appState: state }),

  uploadDocument: async (_file: File) => {
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
      content: `Объясни проблему: «${issue.text}»`,
      timestamp: new Date(),
      relatedIssueId: issue.id,
    };
    set(s => ({ chatMessages: [...s.chatMessages, msg] }));

    // Stream response
    setTimeout(() => {
      const response: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `**${issue.title}**\n\n${issue.description}\n\n💡 **Рекомендация:**\n${issue.suggestion}`,
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
      'Это хороший вопрос. На основе анализа документа могу сказать: требование нуждается в конкретизации через метрики и критерии приёмки (acceptance criteria).',
      'Рекомендую применить шаблон **SMART**: Specific, Measurable, Achievable, Relevant, Time-bound. Это устранит большинство найденных проблем.',
      'Типичная ошибка в ТЗ — отсутствие **Definition of Done**. Убедитесь, что каждое требование имеет верифицируемый критерий.',
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
