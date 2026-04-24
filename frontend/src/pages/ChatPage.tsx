import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Zap, Send, Paperclip, Bot, X,
  ChevronRight, ChevronLeft, Loader2,
  AlertTriangle, Info, AlertCircle,
  UserPlus, Copy, Check, Lightbulb
} from 'lucide-react';
import { useAppStore } from '../app/store';
import type { Message, Attachment } from '../shared/types';
import './chat.css';

/* ── Helpers ────────────────────────────────────────────────────────────────── */
function renderMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br/>');
}

function formatTime(d: Date) {
  return new Date(d).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' });
}

function getInitials(role: Message['role'], authorId: string) {
  if (role === 'ai')     return '🤖';
  if (role === 'system') return '⚙';
  return authorId.charAt(0).toUpperCase();
}

/* ── AI Sidebar ─────────────────────────────────────────────────────────────── */
const AiSidebar: React.FC<{ chatId: string }> = ({ chatId }) => {
  const chatRooms    = useAppStore(s => s.chatRooms);
  const isSidebarOpen = useAppStore(s => s.isSidebarOpen);
  const toggleSidebar = useAppStore(s => s.toggleSidebar);

  const room = chatRooms.find(r => r.id === chatId);
  const analysis = room?.aiAnalysis;

  const iconFor = (sev: string) => {
    if (sev === 'critical') return <AlertTriangle size={13} />;
    if (sev === 'warning')  return <AlertCircle size={13} />;
    return <Info size={13} />;
  };
  const classFor = (sev: string) => {
    if (sev === 'critical') return 'badge-red';
    if (sev === 'warning')  return 'badge-yellow';
    return 'badge-blue';
  };

  return (
    <aside className={`ai-sidebar ${isSidebarOpen ? 'open' : 'closed'}`}>
      {/* Toggle tab */}
      <button className="sidebar-toggle-tab" onClick={toggleSidebar}>
        {isSidebarOpen ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

      <div className="sidebar-content">
        {/* Header */}
        <div className="sidebar-header">
          <div className="flex items-center gap-2">
            <div className="sidebar-ai-icon"><Bot size={15} /></div>
            <div>
              <div className="sidebar-title">AI Analysis</div>
              <div className="text-xs text-muted">Powered by GPT-4o</div>
            </div>
          </div>
        </div>

        {!analysis ? (
          <div className="sidebar-empty">
            <Paperclip size={32} />
            <p>Attach a spec or document to get AI analysis</p>
            <p className="text-xs text-muted">Supported: PDF, DOCX, TXT</p>
          </div>
        ) : (
          <>
            {/* Score */}
            <div className="sidebar-score-card">
              <div className="sidebar-score-ring">
                <svg viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="7" />
                  <circle
                    cx="40" cy="40" r="34"
                    fill="none"
                    stroke={analysis.score > 70 ? 'var(--lime-400)' : analysis.score > 40 ? 'var(--yellow-400)' : 'var(--red-400)'}
                    strokeWidth="7"
                    strokeLinecap="round"
                    strokeDasharray={`${(analysis.score / 100) * 213.6} 213.6`}
                    transform="rotate(-90 40 40)"
                  />
                </svg>
                <span className="sidebar-score-val">{analysis.score}</span>
              </div>
              <div>
                <div className="sidebar-score-label">Quality Score</div>
                <div className="text-sm text-muted">{analysis.summary.slice(0, 60)}…</div>
              </div>
            </div>

            {/* Issues */}
            <div className="sidebar-issues-title text-xs text-muted">
              {analysis.issues.length} ISSUES FOUND
            </div>

            <div className="sidebar-issues">
              {analysis.issues.map(issue => (
                <div key={issue.id} className={`sidebar-issue sidebar-issue--${issue.severity}`}>
                  <div className={`badge ${classFor(issue.severity)} sidebar-issue-badge`}>
                    {iconFor(issue.severity)}
                    {issue.severity}
                  </div>
                  <div className="sidebar-issue-title">{issue.title}</div>
                  <div className="sidebar-issue-desc text-sm text-muted">{issue.description}</div>
                  <div className="sidebar-issue-tip">
                    <Lightbulb size={12} />
                    <span>{issue.suggestion}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </aside>
  );
};

/* ── Main chat page ──────────────────────────────────────────────────────────── */
export const ChatPage: React.FC = () => {
  const { chatId } = useParams<{ chatId: string }>();

  const currentUser  = useAppStore(s => s.currentUser);
  const chatRooms    = useAppStore(s => s.chatRooms);
  const isAiStreaming = useAppStore(s => s.isAiStreaming);
  const sendMessage  = useAppStore(s => s.sendMessage);
  const runCommand   = useAppStore(s => s.runCommand);

  const room = chatRooms.find(r => r.id === chatId);

  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const isCommand = useMemo(() => input.startsWith('/'), [input]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [room?.messages]);


  // Redirect if not found
  if (!room) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 16 }}>
        <p className="text-muted">Chat not found</p>
        <Link to="/" className="btn btn-primary">← Back to chats</Link>
      </div>
    );
  }

  const handleSend = async () => {
    const text = input.trim();
    if (!text && attachments.length === 0) return;

    setInput('');

    if (text.startsWith('/')) {
      await runCommand(chatId!, text);
    } else {
      await sendMessage(chatId!, text, attachments.length > 0 ? attachments : undefined);
    }
    setAttachments([]);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const newAttachments: Attachment[] = files.map(f => ({
      id: `att-${Date.now()}-${f.name}`,
      name: f.name,
      size: f.size,
      type: f.type,
      url: URL.createObjectURL(f),
    }));
    setAttachments(prev => [...prev, ...newAttachments]);
    e.target.value = '';
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  const getMsgClass = (msg: Message) => {
    const isMe = msg.authorId === currentUser?.id;
    if (msg.role === 'ai' || msg.role === 'system') return 'msg--ai';
    return isMe ? 'msg--me' : 'msg--other';
  };

  // Command suggestions
  const COMMANDS = ['/update', '/analyze', '/help'];
  const suggestions = isCommand
    ? COMMANDS.filter(c => c.startsWith(input.toLowerCase()))
    : [];

  // Invite modal state
  const inviteLink = `${window.location.origin}/join/${chatId}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(inviteLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="chat-layout">
      {/* Top nav */}
      <div className="chat-nav glass">
        <div className="chat-nav-left">
          <Link to="/" className="btn btn-ghost chat-back">
            <ArrowLeft size={15} />
          </Link>
          <div className="chat-nav-room">
            <div className="chat-nav-title">{room.title}</div>
            <div className="text-xs text-muted">{room.messages.length} messages</div>
          </div>
        </div>
        <div className="chat-nav-right">
          {room.aiAnalysis && (
            <span className="badge badge-lime">
              <Zap size={10} />
              Analyzed
            </span>
          )}
          <button
            className="btn btn-ghost invite-btn"
            onClick={() => setShowInvite(v => !v)}
            title="Invite collaborator"
          >
            <UserPlus size={15} />
            Invite
          </button>
        </div>
      </div>

      {/* Invite modal */}
      {showInvite && (
        <div className="invite-modal-overlay" onClick={() => setShowInvite(false)}>
          <div className="invite-modal glass animate-fade-up" onClick={e => e.stopPropagation()}>
            <div className="invite-modal-header">
              <div className="invite-modal-title">
                <UserPlus size={16} />
                Invite to "{room.title}"
              </div>
              <button className="invite-modal-close" onClick={() => setShowInvite(false)}>
                <X size={14} />
              </button>
            </div>
            <p className="text-sm text-muted invite-modal-desc">
              Share this link — anyone who opens it will be added to this workspace.
            </p>
            <div className="invite-link-row">
              <input
                className="invite-link-input"
                value={inviteLink}
                readOnly
                onFocus={e => e.target.select()}
              />
              <button
                className={`invite-copy-btn ${copied ? 'copied' : ''}`}
                onClick={handleCopy}
              >
                {copied ? <Check size={15} /> : <Copy size={15} />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <p className="text-xs text-muted invite-link-format">
              Link format: <code>/join/{chatId}</code>
            </p>
          </div>
        </div>
      )}

      {/* Body: messages + sidebar */}
      <div className="chat-body">
        {/* Messages area */}
        <div className="chat-messages-area">
          <div className="chat-messages">
            {room.messages.map((msg, i) => (
              <div
                key={msg.id}
                className={`msg ${getMsgClass(msg)} animate-fade-up`}
                style={{ animationDelay: `${Math.min(i * 30, 300)}ms` }}
              >
                {/* Avatar (left) */}
                {(msg.role === 'ai' || getMsgClass(msg) === 'msg--other') && (
                  <div className={`avatar avatar-${msg.role === 'ai' ? 'ai' : 'client'} msg-avatar`}>
                    {getInitials(msg.role, msg.authorId)}
                  </div>
                )}

                <div className="msg-bubble">
                  {/* Role label for others */}
                  {msg.role !== 'ai' && getMsgClass(msg) !== 'msg--me' && (
                    <div className="msg-author text-xs text-muted">
                      {msg.role === 'client' ? '👤 Client' : '⚡ Developer'}
                    </div>
                  )}
                  {msg.role === 'ai' && (
                    <div className="msg-author text-xs" style={{ color: '#a78bfa' }}>
                      🤖 ReqLens AI
                    </div>
                  )}

                  <div
                    className="msg-content"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                  />

                  {/* Attachments */}
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="msg-attachments">
                      {msg.attachments.map(a => (
                        <a key={a.id} href={a.url} className="msg-attachment" target="_blank" rel="noreferrer">
                          <Paperclip size={12} />
                          <span>{a.name}</span>
                        </a>
                      ))}
                    </div>
                  )}

                  <div className="msg-time text-xs text-muted">{formatTime(msg.timestamp)}</div>
                </div>
              </div>
            ))}

            {isAiStreaming && (
              <div className="msg msg--ai">
                <div className="avatar avatar-ai msg-avatar">🤖</div>
                <div className="msg-bubble">
                  <div className="msg-author text-xs" style={{ color: '#a78bfa' }}>🤖 ReqLens AI</div>
                  <div className="msg-typing">
                    <span /><span /><span />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="chat-input-area">
            {/* Command suggestions */}
            {suggestions.length > 0 && (
              <div className="cmd-suggestions">
                {suggestions.map(cmd => (
                  <button
                    key={cmd}
                    className="cmd-suggestion"
                    onClick={() => setInput(cmd + ' ')}
                  >
                    {cmd}
                  </button>
                ))}
              </div>
            )}

            {/* Attachments preview */}
            {attachments.length > 0 && (
              <div className="attach-preview">
                {attachments.map(a => (
                  <div key={a.id} className="attach-chip">
                    <Paperclip size={11} />
                    <span>{a.name}</span>
                    <button onClick={() => removeAttachment(a.id)}>
                      <X size={11} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="chat-input-row">
              <button
                className="chat-attach-btn"
                onClick={() => fileInputRef.current?.click()}
                title="Attach file"
              >
                <Paperclip size={18} />
              </button>

              <div className="chat-input-wrap">
                <textarea
                  className="chat-input"
                  placeholder={isCommand ? 'Type a command…' : 'Message… or type / for commands'}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  rows={1}
                />
              </div>

              <button
                className={`chat-send ${(!input.trim() && attachments.length === 0) || isAiStreaming ? 'disabled' : ''}`}
                onClick={handleSend}
                disabled={(!input.trim() && attachments.length === 0) || isAiStreaming}
              >
                {isAiStreaming
                  ? <Loader2 size={17} className="animate-spin" />
                  : isCommand
                  ? <Zap size={17} />
                  : <Send size={17} />
                }
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg"
              style={{ display: 'none' }}
              onChange={handleFile}
            />
          </div>
        </div>

        {/* AI Sidebar */}
        <AiSidebar chatId={chatId!} />
      </div>
    </div>
  );
};
