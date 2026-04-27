import type { AiAnalysis, AiDiff, AiIssue, Attachment, ChatRoom, Message } from '../../shared/types';
import type { BackendAiAnalysis, BackendAiDiff, BackendAttachment, BackendIssue, BackendMessage, ChatOut } from '../../shared/api';

function mapSeverity(severity: BackendIssue['severity']): AiIssue['severity'] {
  if (severity === 'critical') return 'critical';
  if (severity === 'high') return 'high';
  if (severity === 'medium') return 'medium';
  if (severity === 'low') return 'low';
  return 'info';
}

function stripMarkdown(value: string): string {
  return value
    .replace(/^#{1,6}\s+/, '')
    .replace(/^[-*+]\s+/, '')
    .replace(/^\d+\.\s+/, '')
    .replace(/\*\*/g, '')
    .replace(/`/g, '')
    .trim();
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1).trim()}…`;
}

export function normalizeAnalysisMarkdown(markdown: string): AiAnalysis | undefined {
  const content = markdown.trim();
  if (!content) return undefined;

  const lines = content
    .split('\n')
    .map(line => stripMarkdown(line))
    .filter(Boolean);

  return {
    summary: truncate(lines[0] ?? 'AI analysis is ready.', 220),
    generatedAt: new Date(),
    analysisMarkdown: content,
  };
}

function normalizeIssue(issue: BackendIssue, index: number): AiIssue {
  const severity = mapSeverity(issue.severity);
  const startLine = issue.start_line;
  const endLine = issue.end_line ?? startLine;

  return {
    id: issue.id || `finding-${index}`,
    severity,
    title: issue.title,
    description: issue.explanation,
    suggestion: issue.recommendation,
    quote: issue.quote,
    startLine,
    endLine,
  };
}

export function normalizeAttachment(attachment: BackendAttachment): Attachment {
  return {
    id: attachment.id,
    name: attachment.filename,
    size: 0,
    type: attachment.content_type,
  };
}

export function normalizeMessage(message: BackendMessage): Message {
  const timestamp = message.timestamp ?? message.created_at;

  return {
    id: message.id,
    chatId: message.chat_id,
    authorId: message.author_id ?? message.role,
    role: message.role,
    content: message.content,
    timestamp: new Date(timestamp),
    attachments: message.attachments?.map(normalizeAttachment),
    status: 'sent',
  };
}

export function normalizeAnalysis(analysis?: BackendAiAnalysis | null): AiAnalysis | undefined {
  if (!analysis) return undefined;
  const firstAnalysisLine = analysis.analysis_markdown.split('\n').find(line => stripMarkdown(line));
  const summary = truncate(stripMarkdown(firstAnalysisLine ?? analysis.analysis_markdown), 220);

  return {
    score: analysis.score,
    summary,
    generatedAt: analysis.generatedAt || analysis.generated_at ? new Date(analysis.generatedAt ?? analysis.generated_at!) : new Date(),
    issues: analysis.findings.map(normalizeIssue),
    analysisMarkdown: analysis.analysis_markdown,
    documentMarkdown: analysis.document_markdown,
  };
}

export function normalizeChat(chat: ChatOut, existing?: ChatRoom): ChatRoom {
  return {
    id: chat.id,
    title: chat.title ?? 'Untitled chat',
    inviteCode: chat.invite_code,
    participants: existing?.participants ?? [],
    messages: existing?.messages ?? [],
    createdAt: new Date(chat.created_at),
    lastMessageAt: new Date(chat.updated_at ?? chat.created_at),
    aiAnalysis: normalizeAnalysis(chat.ai_analysis_json) ?? existing?.aiAnalysis,
  };
}

export function normalizeDiff(diff?: BackendAiDiff | null): AiDiff | undefined {
  if (!diff) return undefined;
  return {
    summary: diff.summary,
    scoreDelta: diff.score_delta,
    generatedAt: diff.generated_at ? new Date(diff.generated_at) : new Date(),
    analysisMarkdown: diff.analysis_markdown,
  };
}
