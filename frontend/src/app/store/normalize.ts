import type { AiAnalysis, Attachment, ChatRoom, Message } from '../../shared/types';
import type { BackendAiAnalysis, BackendAttachment, BackendMessage, ChatOut } from '../../shared/api';

function mapSeverity(severity: BackendAiAnalysis['issues'][number]['severity']): AiAnalysis['issues'][number]['severity'] {
  if (severity === 'critical' || severity === 'high') return 'critical';
  if (severity === 'warning' || severity === 'medium') return 'warning';
  return 'info';
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
  };
}

export function normalizeAnalysis(analysis?: BackendAiAnalysis | null): AiAnalysis | undefined {
  if (!analysis) return undefined;

  return {
    score: analysis.score,
    summary: analysis.summary,
    generatedAt: analysis.generatedAt ? new Date(analysis.generatedAt) : new Date(),
    issues: analysis.issues.map(issue => ({
      id: issue.id,
      severity: mapSeverity(issue.severity),
      title: issue.title,
      description: issue.description,
      suggestion: issue.suggestion,
    })),
  };
}

export function normalizeChat(chat: ChatOut, existing?: ChatRoom): ChatRoom {
  return {
    id: chat.id,
    title: chat.title,
    inviteCode: chat.invite_code,
    participants: existing?.participants ?? [],
    messages: existing?.messages ?? [],
    createdAt: new Date(chat.created_at),
    lastMessageAt: new Date(chat.updated_at ?? chat.created_at),
    aiAnalysis: normalizeAnalysis(chat.ai_analysis_json),
  };
}
