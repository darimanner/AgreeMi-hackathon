import type { Attachment, ChatRoom, Message, User } from '../types';

export interface ApiUser {
  id: string;
  email: string;
  name: string;
  role: User['role'];
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: 'bearer';
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  role?: User['role'];
}

export type RegisterResponse = ApiUser;

export interface ChatOut {
  id: string;
  title: string | null;
  invite_code: string;
  developer_id?: string;
  client_id?: string | null;
  developer_ids?: string[];
  client_ids?: string[];
  ai_analysis_json?: BackendAiAnalysis | null;
  created_at: string;
  updated_at?: string;
}

export interface ChatJoinResponse {
  chat: ChatOut;
  message: string;
}

export interface BackendAttachment {
  id: string;
  filename: string;
  content_type: string;
}

export interface BackendMessage {
  id: string;
  chat_id: string;
  author_id: string | null;
  role: Message['role'];
  content: string;
  created_at: string;
  timestamp?: string;
  attachments: BackendAttachment[];
}

export interface BackendIssue {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  explanation: string;
  recommendation: string;
  quote?: string;
  start_line?: number;
  end_line?: number;
}

export interface BackendAiAnalysis {
  document_markdown: string;
  analysis_markdown: string;
  score: number;
  findings: BackendIssue[];
  generatedAt?: string;
  generated_at?: string;
}

export interface CommandResponse {
  command: string;
  result: string;
  message: BackendMessage;
  analysis?: BackendAiAnalysis | null;
}

export interface NormalizedChatRoom extends ChatRoom {
  inviteCode?: string;
}

export interface ChatMessagesQuery {
  limit?: number;
  offset?: number;
}

export interface SendMessageInput {
  content: string;
  file?: File;
}

export interface NormalizedAttachment extends Attachment {
  filename?: string;
}
