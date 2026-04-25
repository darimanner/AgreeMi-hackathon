import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Paperclip, AlertTriangle, Info, AlertCircle, Lightbulb, Bot
} from 'lucide-react';
import { createDocumentBlocks, getIssueForBlock, isIssuePopoverAnchor } from '../utils/markdownAnalysis';
import type { AiAnalysis } from '../types';

interface AiAnalysisContentProps {
  analysis?: AiAnalysis;
  showTitle?: boolean;
}

export const AiAnalysisContent: React.FC<AiAnalysisContentProps> = ({ analysis, showTitle = false }) => {
  const issues = analysis?.issues ?? [];
  const documentMarkdown = analysis?.documentMarkdown;
  const documentBlocks = useMemo(() => 
    documentMarkdown ? createDocumentBlocks(documentMarkdown) : [], 
    [documentMarkdown]
  );

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

  if (!analysis) {
    return (
      <div className="sidebar-empty">
        <Paperclip size={32} />
        <p>Attach a spec or document to get AI analysis</p>
        <p className="text-xs text-muted">Supported: PDF, DOCX, TXT</p>
      </div>
    );
  }

  return (
    <>
      {showTitle && (
        <div className="sidebar-header">
          <div className="flex items-center gap-2">
            <div className="sidebar-ai-icon"><Bot size={15} /></div>
            <div>
              <div className="sidebar-title">AI Analysis</div>
              <div className="text-xs text-muted">Powered by GPT-4o</div>
            </div>
          </div>
        </div>
      )}

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
            <div className="text-sm text-muted">{analysis.summary.slice(0, 80)}…</div>
          </div>
        </div>
      )}

      {documentBlocks.length > 0 && (
        <div className="sidebar-section">
          <div className="sidebar-section-title">Reviewed Document</div>
          <div className="sidebar-document">
            {documentBlocks.map(block => {
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
                          {block.rows?.map((row, ri) => (
                            <tr key={`${block.id}-r-${ri}`}>
                              {row.map((cell, ci) => (
                                <td key={`${block.id}-c-${ri}-${ci}`} className={ci % 2 === 0 ? 'document-kv-label' : undefined}>
                                  {cell || <span>&nbsp;</span>}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : block.kind === 'req-table' ? (
                      <table className="document-req-table">
                        <thead><tr>{block.rows?.[0]?.map((c, ci) => <th key={ci}>{c}</th>)}</tr></thead>
                        <tbody>
                          {block.rows?.slice(1).map((row, ri) => (
                            <tr key={ri}>{row.map((c, ci) => <td key={ci}>{c || <span>&nbsp;</span>}</td>)}</tr>
                          ))}
                        </tbody>
                      </table>
                    ) : block.kind === 'step-table' ? (
                      <table className="document-step-table">
                        <thead><tr>{block.rows?.[0]?.map((c, ci) => <th key={ci}>{c}</th>)}</tr></thead>
                        <tbody>
                          {block.rows?.slice(1).map((row, ri) => (
                            <tr key={ri}>{row.map((c, ci) => <td key={ci}>{c || <span>&nbsp;</span>}</td>)}</tr>
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
                      {popoverIssue.quote && <div className="document-popover-quote">"{popoverIssue.quote}"</div>}
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
  );
};
