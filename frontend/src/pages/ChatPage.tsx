import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  ArrowLeft, Zap, Send, Paperclip, Bot, X,
  ChevronRight, ChevronLeft, Loader2,
  AlertTriangle, Info, AlertCircle,
  UserPlus, Copy, Check, Lightbulb, GripVertical, Moon, Sun, Wifi, WifiOff
} from 'lucide-react';
import { useAppStore } from '../app/store';
import { closeChatSocket, connectChatSocket, pingApiServer } from '../shared/api';
import { getErrorMessage } from '../shared/api';
import type { Message, Attachment, AiIssue } from '../shared/types';
import './chat.css';

/* ── Helpers ────────────────────────────────────────────────────────────────── */
function formatTime(d: Date) {
  return new Date(d).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' });
}

function getInitials(role: Message['role'], authorId: string) {
  if (role === 'ai')     return '🤖';
  if (role === 'system') return '⚙';
  return authorId.charAt(0).toUpperCase();
}

function shortId(value: string): string {
  return value.length > 8 ? value.slice(0, 8) : value;
}

type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'error' | 'closed';

type DocumentBlock = {
  id: string;
  startLine: number;
  endLine: number;
  content: string;
  kind: 'table' | 'kv-table' | 'req-table' | 'step-table' | 'text';
  rows?: string[][];
};

function isMarkdownTableSeparator(line: string): boolean {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
}

function isMarkdownTableRow(line: string): boolean {
  return line.includes('|') && line.trim().split('|').filter(cell => cell.trim()).length >= 2;
}

function parseMarkdownTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map(cell => cell.trim());
}

function getSingleRowKvTable(block: DocumentBlock): string[] | null {
  if (block.kind !== 'table') return null;
  const rows = block.content
    .split('\n')
    .filter(line => isMarkdownTableRow(line) && !isMarkdownTableSeparator(line))
    .map(parseMarkdownTableRow);

  if (rows.length !== 1 || rows[0].length < 3 || rows[0].length > 4) return null;
  return [...rows[0], '', '', '', ''].slice(0, 4);
}

function isTableContinuationText(block: DocumentBlock): boolean {
  const value = block.content.trim();
  if (!value) return false;
  if (block.kind !== 'text') return false;
  if (/^#{1,6}\s/.test(value)) return false;
  if (/^\d+\.\s/.test(value)) return false;
  if (/^[-*+]\s/.test(value)) return false;
  return value.length <= 80;
}

function appendCellValue(value: string, extra: string): string {
  return [value, extra].filter(Boolean).join(' ').trim();
}

function getTableRows(block: DocumentBlock): string[][] {
  if (block.kind !== 'table') return [];
  return block.content
    .split('\n')
    .filter(line => isMarkdownTableRow(line) && !isMarkdownTableSeparator(line))
    .map(parseMarkdownTableRow);
}

function getNonEmptyCells(row: string[]): string[] {
  return row.map(cell => cell.trim()).filter(Boolean);
}

function getRequirementHeader(block: DocumentBlock): string[] | null {
  const rows = getTableRows(block);
  if (rows.length !== 1) return null;

  const cells = getNonEmptyCells(rows[0]);
  const normalized = cells.join(' ').toLowerCase();
  if (!normalized.includes('id') || !normalized.includes('user story') || !normalized.includes('acceptance')) {
    return null;
  }

  return ['ID', 'User story', 'Acceptance criteria'];
}

function getStepHeader(block: DocumentBlock): string[] | null {
  const rows = getTableRows(block);
  if (rows.length !== 1) return null;

  const cells = getNonEmptyCells(rows[0]);
  const normalized = cells.join(' ').toLowerCase();
  if (!normalized.includes('step') || !normalized.includes('name')) return null;
  if (!normalized.includes('behaviour') && !normalized.includes('behavior')) return null;

  return ['Step', 'Name', 'Behaviour & rules'];
}

function getContinuationCells(block: DocumentBlock): string[] {
  const rows = getTableRows(block);
  if (rows.length !== 1) return [];
  return getNonEmptyCells(rows[0]);
}

function parseRequirementLine(value: string): string[] | null {
  const match = value.trim().match(/^([A-Z]{2,}(?:-[A-Z]+)?\d{1,3})\s+(.+)$/);
  if (!match) return null;
  return [match[1], match[2], ''];
}

function parseStepLine(value: string): string[] | null {
  const match = value.trim().match(/^(\d{1,2})\s+(.+)$/);
  if (!match) return null;

  const rest = match[2].trim();
  const twoWordName = rest.match(/^(Cart review)\s+(.+)$/i);
  if (twoWordName) return [match[1], twoWordName[1], twoWordName[2]];

  const firstWord = rest.match(/^(\S+)\s+(.+)$/);
  if (!firstWord) return [match[1], rest, ''];

  return [match[1], firstWord[1], firstWord[2]];
}

function isSectionHeadingBlock(block: DocumentBlock): boolean {
  if (block.kind !== 'text') return false;
  return /^\s*\d+(?:\.\d+)*\s+/.test(block.content);
}

function repairRequirementTables(blocks: DocumentBlock[]): DocumentBlock[] {
  const repaired: DocumentBlock[] = [];
  let index = 0;

  while (index < blocks.length) {
    const header = getRequirementHeader(blocks[index]);
    if (!header) {
      repaired.push(blocks[index]);
      index += 1;
      continue;
    }

    const rows = [header];
    const startLine = blocks[index].startLine;
    let endLine = blocks[index].endLine;
    let cursor = index + 1;
    let currentRow: string[] | null = null;

    while (cursor < blocks.length) {
      const block = blocks[cursor];
      if (isSectionHeadingBlock(block)) break;

      if (block.kind === 'text') {
        const parsed = parseRequirementLine(block.content);
        if (parsed) {
          if (currentRow) rows.push(currentRow);
          currentRow = parsed;
          endLine = block.endLine;
          cursor += 1;
          continue;
        }

        if (currentRow && isTableContinuationText(block)) {
          currentRow[1] = appendCellValue(currentRow[1], block.content.trim());
          endLine = block.endLine;
          cursor += 1;
          continue;
        }

        break;
      }

      const cells = getContinuationCells(block);
      if (currentRow && cells.length > 0 && cells.length <= 3) {
        if (cells[0]) currentRow[1] = appendCellValue(currentRow[1], cells[0]);
        if (cells[1]) currentRow[2] = appendCellValue(currentRow[2], cells[1]);
        if (cells[2]) currentRow[2] = appendCellValue(currentRow[2], cells[2]);
        endLine = block.endLine;
        cursor += 1;
        continue;
      }

      break;
    }

    if (currentRow) rows.push(currentRow);

    if (rows.length > 1) {
      repaired.push({
        id: `req-table-${startLine}`,
        startLine,
        endLine,
        content: '',
        kind: 'req-table',
        rows,
      });
      index = cursor;
      continue;
    }

    repaired.push(blocks[index]);
    index += 1;
  }

  return repaired;
}

function repairStepTables(blocks: DocumentBlock[]): DocumentBlock[] {
  const repaired: DocumentBlock[] = [];
  let index = 0;

  while (index < blocks.length) {
    const header = getStepHeader(blocks[index]);
    if (!header) {
      repaired.push(blocks[index]);
      index += 1;
      continue;
    }

    const rows = [header];
    const startLine = blocks[index].startLine;
    let endLine = blocks[index].endLine;
    let cursor = index + 1;
    let currentRow: string[] | null = null;

    while (cursor < blocks.length) {
      const block = blocks[cursor];
      if (isSectionHeadingBlock(block)) break;

      if (block.kind === 'text') {
        const parsed = parseStepLine(block.content);
        if (parsed) {
          if (currentRow) rows.push(currentRow);
          currentRow = parsed;
          endLine = block.endLine;
          cursor += 1;
          continue;
        }

        if (currentRow && isTableContinuationText(block)) {
          currentRow[2] = appendCellValue(currentRow[2], block.content.trim());
          endLine = block.endLine;
          cursor += 1;
          continue;
        }

        break;
      }

      const cells = getContinuationCells(block);
      if (currentRow && cells.length > 0 && cells.length <= 3) {
        if (cells[0]) currentRow[1] = appendCellValue(currentRow[1], cells[0]);
        if (cells[1]) currentRow[2] = appendCellValue(currentRow[2], cells[1]);
        if (cells[2]) currentRow[2] = appendCellValue(currentRow[2], cells[2]);
        endLine = block.endLine;
        cursor += 1;
        continue;
      }

      break;
    }

    if (currentRow) rows.push(currentRow);

    if (rows.length > 1) {
      repaired.push({
        id: `step-table-${startLine}`,
        startLine,
        endLine,
        content: '',
        kind: 'step-table',
        rows,
      });
      index = cursor;
      continue;
    }

    repaired.push(blocks[index]);
    index += 1;
  }

  return repaired;
}

function repairDocumentBlocks(blocks: DocumentBlock[]): DocumentBlock[] {
  const repaired: DocumentBlock[] = [];
  let index = 0;

  while (index < blocks.length) {
    const firstRow = getSingleRowKvTable(blocks[index]);
    if (!firstRow) {
      repaired.push(blocks[index]);
      index += 1;
      continue;
    }

    const rows = [firstRow];
    const startLine = blocks[index].startLine;
    let endLine = blocks[index].endLine;
    let cursor = index + 1;
    let pendingText: string[] = [];

    while (cursor < blocks.length) {
      const row = getSingleRowKvTable(blocks[cursor]);

      if (row) {
        if (pendingText.length > 0) {
          const pending = pendingText.join(' ');
          if (!row[3]) {
            row[3] = pending;
          } else {
            rows[rows.length - 1][3] = appendCellValue(rows[rows.length - 1][3], pending);
          }
          pendingText = [];
        }

        rows.push(row);
        endLine = blocks[cursor].endLine;
        cursor += 1;
        continue;
      }

      if (isTableContinuationText(blocks[cursor])) {
        pendingText.push(blocks[cursor].content.trim());
        endLine = blocks[cursor].endLine;
        cursor += 1;
        continue;
      }

      break;
    }

    if (pendingText.length > 0) {
      rows[rows.length - 1][3] = appendCellValue(rows[rows.length - 1][3], pendingText.join(' '));
    }

    if (rows.length > 1) {
      repaired.push({
        id: `kv-table-${startLine}`,
        startLine,
        endLine,
        content: '',
        kind: 'kv-table',
        rows,
      });
      index = cursor;
      continue;
    }

    repaired.push(blocks[index]);
    index += 1;
  }

  return repairStepTables(repairRequirementTables(repaired));
}

function createDocumentBlocks(markdown: string): DocumentBlock[] {
  const lines = markdown.split('\n');
  const blocks: DocumentBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const nextLine = lines[index + 1] ?? '';

    if (isMarkdownTableRow(line) && isMarkdownTableSeparator(nextLine)) {
      const start = index;
      index += 2;
      while (index < lines.length && isMarkdownTableRow(lines[index])) {
        index += 1;
      }

      blocks.push({
        id: `table-${start + 1}`,
        startLine: start + 1,
        endLine: index,
        content: lines.slice(start, index).join('\n'),
        kind: 'table',
      });
      continue;
    }

    blocks.push({
      id: `line-${index + 1}`,
      startLine: index + 1,
      endLine: index + 1,
      content: line,
      kind: 'text',
    });
    index += 1;
  }

  return repairDocumentBlocks(blocks);
}

function getIssueForBlock(block: DocumentBlock, issues: AiIssue[]): AiIssue | undefined {
  return issues.find(issue => {
    if (!issue.startLine) return false;
    const issueEndLine = issue.endLine ?? issue.startLine;
    return issue.startLine <= block.endLine && issueEndLine >= block.startLine;
  });
}

function isIssuePopoverAnchor(block: DocumentBlock, issue: AiIssue): boolean {
  if (!issue.startLine) return false;
  return issue.startLine >= block.startLine && issue.startLine <= block.endLine;
}

/* ── AI Sidebar ─────────────────────────────────────────────────────────────── */
const AiSidebar: React.FC<{ chatId: string }> = ({ chatId }) => {
  const chatRooms    = useAppStore(s => s.chatRooms);
  const isSidebarOpen = useAppStore(s => s.isSidebarOpen);
  const toggleSidebar = useAppStore(s => s.toggleSidebar);
  const [sidebarWidth, setSidebarWidth] = useState(360);

  const room = chatRooms.find(r => r.id === chatId);
  const analysis = room?.aiAnalysis;
  const issues = analysis?.issues ?? [];
  const documentMarkdown = analysis?.documentMarkdown;
  const documentBlocks = documentMarkdown ? createDocumentBlocks(documentMarkdown) : [];

  const handleResizeStart = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = sidebarWidth;

    const handleResizeMove = (moveEvent: PointerEvent) => {
      const maxWidth = Math.min(window.innerWidth - 360, 640);
      const nextWidth = Math.min(Math.max(startWidth - (moveEvent.clientX - startX), 280), Math.max(320, maxWidth));
      setSidebarWidth(nextWidth);
    };

    const handleResizeEnd = () => {
      window.removeEventListener('pointermove', handleResizeMove);
      window.removeEventListener('pointerup', handleResizeEnd);
    };

    window.addEventListener('pointermove', handleResizeMove);
    window.addEventListener('pointerup', handleResizeEnd, { once: true });
  };

  const iconFor = (sev: string) => {
    if (sev === 'critical' || sev === 'high') return <AlertTriangle size={13} />;
    if (sev === 'medium') return <AlertCircle size={13} />;
    return <Info size={13} />;
  };
  const classFor = (sev: string) => {
    if (sev === 'critical' || sev === 'high') return 'badge-red';
    if (sev === 'medium') return 'badge-yellow';
    return 'badge-blue';
  };

  return (
    <aside
      className={`ai-sidebar ${isSidebarOpen ? 'open' : 'closed'}`}
      style={{ '--sidebar-width': `${sidebarWidth}px` } as React.CSSProperties}
    >
      <button
        className="sidebar-resize-handle"
        onPointerDown={handleResizeStart}
        title="Resize analysis panel"
      >
        <GripVertical size={14} />
      </button>
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
            {typeof analysis.score === 'number' && (
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
            )}

            {documentBlocks.length > 0 && (
              <div className="sidebar-section">
                <div className="sidebar-section-title">Reviewed Document</div>
                <div className="sidebar-document">
                  {documentBlocks.map((block) => {
                    const issue = getIssueForBlock(block, issues);
                    const showPopover = issue ? isIssuePopoverAnchor(block, issue) : false;
                    const popoverIssue = showPopover ? issue : undefined;
                    const lineLabel = block.startLine === block.endLine
                      ? block.startLine
                      : `${block.startLine}-${block.endLine}`;
                    return (
                      <div
                        key={block.id}
                        className={`document-block document-block--${block.kind} ${issue ? `document-line--${issue.severity}` : ''}`}
                        title={issue ? `${issue.severity}: ${issue.title}` : undefined}
                        tabIndex={issue ? 0 : undefined}
                      >
                        <span className="document-line-number">{lineLabel}</span>
                        <div className="document-block-content">
                          {block.kind === 'kv-table' ? (
                            <table className="document-kv-table">
                              <tbody>
                                {block.rows?.map((row, rowIndex) => (
                                  <tr key={`${block.id}-row-${rowIndex}`}>
                                    {row.map((cell, cellIndex) => (
                                      <td
                                        key={`${block.id}-cell-${rowIndex}-${cellIndex}`}
                                        className={cellIndex % 2 === 0 ? 'document-kv-label' : undefined}
                                      >
                                        {cell || <span>&nbsp;</span>}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          ) : block.kind === 'req-table' ? (
                            <table className="document-req-table">
                              <thead>
                                <tr>
                                  {block.rows?.[0]?.map((cell, cellIndex) => (
                                    <th key={`${block.id}-head-${cellIndex}`}>{cell}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {block.rows?.slice(1).map((row, rowIndex) => (
                                  <tr key={`${block.id}-row-${rowIndex}`}>
                                    {row.map((cell, cellIndex) => (
                                      <td key={`${block.id}-cell-${rowIndex}-${cellIndex}`}>
                                        {cell || <span>&nbsp;</span>}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          ) : block.kind === 'step-table' ? (
                            <table className="document-step-table">
                              <thead>
                                <tr>
                                  {block.rows?.[0]?.map((cell, cellIndex) => (
                                    <th key={`${block.id}-head-${cellIndex}`}>{cell}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {block.rows?.slice(1).map((row, rowIndex) => (
                                  <tr key={`${block.id}-row-${rowIndex}`}>
                                    {row.map((cell, cellIndex) => (
                                      <td key={`${block.id}-cell-${rowIndex}-${cellIndex}`}>
                                        {cell || <span>&nbsp;</span>}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          ) : block.content.trim()
                            ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{block.content}</ReactMarkdown>
                            : <span>&nbsp;</span>}
                        </div>
                        {popoverIssue && (
                          <div className={`document-popover document-popover--${popoverIssue.severity}`}>
                            <div className={`badge ${classFor(popoverIssue.severity)} document-popover-badge`}>
                              {iconFor(popoverIssue.severity)}
                              {popoverIssue.severity}
                            </div>
                            <div className="document-popover-title">{popoverIssue.title}</div>
                            <div className="document-popover-desc">{popoverIssue.description}</div>
                            {popoverIssue.quote && (
                              <div className="document-popover-quote">“{popoverIssue.quote}”</div>
                            )}
                            {popoverIssue.suggestion && (
                              <div className="document-popover-tip">
                                <Lightbulb size={12} />
                                <span>{popoverIssue.suggestion}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
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
  const isAuthenticated = useAppStore(s => s.isAuthenticated);
  const accessToken  = useAppStore(s => s.accessToken);
  const theme = useAppStore(s => s.theme);
  const toggleTheme = useAppStore(s => s.toggleTheme);
  const isAiStreaming = useAppStore(s => s.isAiStreaming);
  const streamingChatId = useAppStore(s => s.streamingChatId);
  const leaveChat = useAppStore(s => s.leaveChat);
  const loadMessages = useAppStore(s => s.loadMessages);
  const receiveMessage = useAppStore(s => s.receiveMessage);
  const sendMessage  = useAppStore(s => s.sendMessage);
  const runCommand   = useAppStore(s => s.runCommand);

  const room = chatRooms.find(r => r.id === chatId);

  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const isCommand = useMemo(() => input.startsWith('/'), [input]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sendError, setSendError] = useState('');
  const [connection, setConnection] = useState<{ status: ConnectionStatus; rttMs?: number }>({ status: 'idle' });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [room?.messages]);

  useEffect(() => {
    if (isAuthenticated && chatId) {
      void loadMessages(chatId);
    }

    return () => {
      if (chatId) leaveChat(chatId);
    };
  }, [isAuthenticated, chatId, leaveChat, loadMessages]);

  useEffect(() => {
    if (!accessToken || !chatId) {
      queueMicrotask(() => setConnection({ status: 'idle' }));
      return;
    }

    if (socketRef.current) {
      closeChatSocket(socketRef.current);
    }
    const startedAt = performance.now();
    queueMicrotask(() => setConnection({ status: 'connecting' }));

    const socket = connectChatSocket(chatId, accessToken, {
      onOpen: () => {
        if (socketRef.current !== socket) return;
        setConnection({ status: 'connected', rttMs: Math.round(performance.now() - startedAt) });
      },
      onMessage: (incoming) => {
        if (socketRef.current !== socket) return;
        receiveMessage(chatId, {
          id: incoming.id,
          chatId: incoming.chat_id,
          authorId: incoming.author_id ?? incoming.role,
          role: incoming.role,
          content: incoming.content,
          timestamp: new Date(incoming.timestamp ?? incoming.created_at ?? Date.now()),
          attachments: incoming.attachments.map(a => ({
            id: a.id,
            name: a.filename,
            size: 0,
            type: a.content_type,
          })),
        });
      },
      onError: () => {
        if (socketRef.current === socket) {
          setConnection({ status: 'error' });
        }
        if (import.meta.env.DEV && socketRef.current === socket) {
          console.warn('[chat-ws] connection error', { chatId, url: socket.url });
        }
      },
      onClose: (event) => {
        if (socketRef.current === socket) {
          setConnection({ status: event.code === 1000 ? 'closed' : 'error' });
        }
        if (import.meta.env.DEV && socketRef.current === socket && event.code !== 1000) {
          console.warn('[chat-ws] connection closed', {
            chatId,
            code: event.code,
            reason: event.reason || '(empty)',
            wasClean: event.wasClean,
          });
        }
      },
    });
    socketRef.current = socket;

    return () => {
      if (socketRef.current === socket) {
        socketRef.current = null;
      }
      closeChatSocket(socket);
    };
  }, [accessToken, chatId, receiveMessage]);

  useEffect(() => {
    if (!accessToken || !chatId) return;

    const controller = new AbortController();

    const measurePing = async () => {
      try {
        const rttMs = await pingApiServer(controller.signal);
        setConnection(current => (
          current.status === 'connected' || current.status === 'connecting'
            ? { ...current, rttMs }
            : current
        ));
      } catch (error) {
        if (!controller.signal.aborted) {
          setConnection(current => (
            current.status === 'connected' || current.status === 'connecting'
              ? { ...current, status: 'error' }
              : current
          ));
          if (import.meta.env.DEV) {
            console.warn('[api-ping] failed', error);
          }
        }
      }
    };

    const intervalId = window.setInterval(() => {
      void measurePing();
    }, 10_000);

    return () => {
      controller.abort();
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [accessToken, chatId]);


  // Redirect if not found
  if (!room) {
    if (isAuthenticated && chatRooms.length === 0) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 16 }}>
          <Loader2 size={24} className="animate-spin text-muted" />
          <p className="text-muted">Loading chat…</p>
        </div>
      );
    }

    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 16 }}>
        <p className="text-muted">Chat not found</p>
        <Link to="/" className="btn btn-primary">← Back to chats</Link>
      </div>
    );
  }

  const isCurrentChatStreaming = isAiStreaming && streamingChatId === chatId;
  const hasStreamingMessage = room.messages.some(message => message.isStreaming);
  const isConnectionLive = connection.status === 'connected';
  const connectionLabel = connection.status === 'connected'
    ? `${connection.rttMs ?? 0}ms`
    : connection.status === 'connecting'
    ? 'Connecting'
    : connection.status === 'idle'
    ? 'Offline'
    : 'Disconnected';

  const handleSend = async () => {
    const text = input.trim();
    if (!text && attachments.length === 0) return;
    const messageText = text || 'Please analyze the attached file.';

    setInput('');
    setSendError('');

    try {
      if (messageText.startsWith('/')) {
        await runCommand(chatId!, messageText);
      } else {
        await sendMessage(chatId!, messageText, attachments.length > 0 ? attachments : undefined);
      }

      attachments.forEach(a => {
        if (a.url?.startsWith('blob:')) {
          URL.revokeObjectURL(a.url);
        }
      });
      setAttachments([]);
    } catch (error) {
      setInput(text);
      setSendError(getErrorMessage(error));
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    attachments.forEach(a => {
      if (a.url?.startsWith('blob:')) {
        URL.revokeObjectURL(a.url);
      }
    });

    const newAttachment: Attachment = {
      id: `att-${Date.now()}-${file.name}`,
      name: file.name,
      size: file.size,
      type: file.type,
      url: URL.createObjectURL(file),
      file,
    };
    setAttachments([newAttachment]);
    e.target.value = '';
  };

  const removeAttachment = (id: string) => {
    const removed = attachments.find(a => a.id === id);
    if (removed?.url?.startsWith('blob:')) {
      URL.revokeObjectURL(removed.url);
    }
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  const getMsgClass = (msg: Message) => {
    const isMe = msg.authorId === currentUser?.id;
    if (msg.role === 'ai' || msg.role === 'system') return 'msg--ai';
    return isMe ? 'msg--me' : 'msg--other';
  };

  const getMessageAuthorName = (msg: Message) => {
    if (msg.role === 'ai') return 'ReqLens AI';
    if (msg.role === 'system') return 'System';
    if (msg.authorId === currentUser?.id) return currentUser.name;

    const participant = room.participants.find(user => user.id === msg.authorId);
    return participant?.name ?? shortId(msg.authorId);
  };

  // Command suggestions
  const COMMANDS = ['/update', '/analyze', '/help'];
  const suggestions = isCommand
    ? COMMANDS.filter(c => c.startsWith(input.toLowerCase()))
    : [];

  // Invite modal state
  const inviteCode = room.inviteCode ?? chatId;
  const inviteJoinLink = `${window.location.origin}/join/${inviteCode}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(inviteJoinLink).then(() => {
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
          <span
            className={`connection-badge connection-badge--${connection.status}`}
            title={`Realtime server: ${connectionLabel}`}
          >
            {isConnectionLive ? <Wifi size={12} /> : <WifiOff size={12} />}
            {connectionLabel}
          </span>
          {room.aiAnalysis && (
            <span className="badge badge-lime">
              <Zap size={10} />
              Analyzed
            </span>
          )}
          <button className="btn btn-ghost theme-toggle" onClick={toggleTheme} title="Toggle theme">
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          </button>
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
                value={inviteJoinLink}
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
              Link format: <code>/join/{inviteCode}</code>
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
                    {getInitials(msg.role, getMessageAuthorName(msg))}
                  </div>
                )}

                <div className="msg-bubble">
                  {/* Role label for others */}
                  {msg.role !== 'ai' && getMsgClass(msg) !== 'msg--me' && (
                    <div className="msg-author text-xs text-muted">
                      {getMessageAuthorName(msg)}
                    </div>
                  )}
                  {msg.role === 'ai' && (
                    <div className="msg-author text-xs" style={{ color: '#a78bfa' }}>
                      🤖 ReqLens AI
                    </div>
                  )}

                  <div className="msg-content">
                    {msg.isStreaming ? (
                      <div className="msg-streaming-content">
                        <span>{msg.content}</span>
                        <span className="msg-streaming-dots"><i /><i /><i /></span>
                      </div>
                    ) : (
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                    )}
                  </div>

                  {/* Attachments */}
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="msg-attachments">
                      {msg.attachments.map(a => (
                        a.url ? (
                          <a key={a.id} href={a.url} className="msg-attachment" target="_blank" rel="noreferrer">
                            <Paperclip size={12} />
                            <span>{a.name}</span>
                          </a>
                        ) : (
                          <div key={a.id} className="msg-attachment">
                            <Paperclip size={12} />
                            <span>{a.name}</span>
                          </div>
                        )
                      ))}
                    </div>
                  )}

                  <div className={`msg-time text-xs text-muted msg-time--${msg.status ?? 'sent'}`}>
                    {msg.status === 'sending'
                      ? 'Sending…'
                      : msg.status === 'failed'
                      ? 'Failed'
                      : formatTime(msg.timestamp)}
                  </div>
                </div>
              </div>
            ))}

            {isCurrentChatStreaming && !hasStreamingMessage && (
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

            {sendError && (
              <div className="chat-send-error">{sendError}</div>
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
                className={`chat-send ${(!input.trim() && attachments.length === 0) || isCurrentChatStreaming ? 'disabled' : ''}`}
                onClick={handleSend}
                disabled={(!input.trim() && attachments.length === 0) || isCurrentChatStreaming}
              >
                {isCurrentChatStreaming
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
