import React, { useCallback, useMemo } from 'react';
import type { Issue } from '../../shared/types';
import { useAppStore } from '../../app/store';
import './document-viewer.css';

interface Segment {
  text: string;
  issue?: Issue;
}

function buildSegments(rawText: string, issues: Issue[]): Segment[] {
  // Sort issues by start index
  const sorted = [...issues].sort((a, b) => a.startIndex - b.startIndex);
  const segments: Segment[] = [];
  let cursor = 0;

  for (const issue of sorted) {
    const start = Math.min(issue.startIndex, rawText.length);
    const end = Math.min(issue.endIndex, rawText.length);
    if (start > cursor) {
      segments.push({ text: rawText.slice(cursor, start) });
    }
    if (end > start) {
      segments.push({ text: rawText.slice(start, end), issue });
    }
    cursor = end;
  }

  if (cursor < rawText.length) {
    segments.push({ text: rawText.slice(cursor) });
  }

  return segments;
}

export const DocumentViewer: React.FC = () => {
  const document = useAppStore(s => s.document);
  const selectedIssue = useAppStore(s => s.selectedIssue);
  const selectIssue = useAppStore(s => s.selectIssue);

  const segments = useMemo(() => {
    if (!document) return [];
    return buildSegments(document.rawText, document.issues);
  }, [document]);

  const handleIssueClick = useCallback((issue: Issue) => {
    selectIssue(selectedIssue?.id === issue.id ? null : issue);
  }, [selectIssue, selectedIssue]);

  if (!document) return null;

  return (
    <div className="docview animate-slide-left">
      {/* Header */}
      <div className="docview-header">
        <div className="docview-header-left">
          <div className="docview-filename">
            <span className="docview-filename-icon">📄</span>
            <span>example-spec.pdf</span>
          </div>
          <div className="docview-stats">
            <span className="badge badge-error">{document.stats.criticalIssues} critical</span>
            <span className="badge badge-warning">{document.stats.warnings} warnings</span>
            <span className="badge badge-lime">{document.stats.totalRequirements} requirements</span>
          </div>
        </div>
        <div className="docview-score-wrap">
          <div className="docview-score" title="Качество ТЗ">
            <svg className="docview-score-ring" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="15" fill="none" stroke="var(--color-surface-3)" strokeWidth="3"/>
              <circle cx="18" cy="18" r="15" fill="none"
                stroke={document.score > 60 ? 'var(--color-lime-400)' : document.score > 30 ? 'var(--color-warning)' : 'var(--color-error)'}
                strokeWidth="3"
                strokeDasharray={`${(document.score / 100) * 94.2} 94.2`}
                strokeLinecap="round"
                strokeDashoffset="23.55"
                transform="rotate(-90 18 18)"
              />
            </svg>
            <span className="docview-score-val">{document.score}</span>
          </div>
          <div className="docview-score-label">
            <span>Quality</span>
            <span className="docview-score-grade">
              {document.score > 60 ? 'Good' : document.score > 30 ? 'Fair' : 'Poor'}
            </span>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="docview-legend">
        <div className="legend-item">
          <span className="legend-dot legend-dot--critical" />
          <span>Critical issue</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot legend-dot--warning" />
          <span>Warning</span>
        </div>
        <span className="text-muted" style={{ fontSize: 12 }}>Click a highlighted passage</span>
      </div>

      {/* Document content */}
      <div className="docview-content">
        <div className="docview-text">
          {segments.map((seg, i) => {
            if (!seg.issue) {
              return (
                <span key={i} className="docview-plain">
                  {seg.text}
                </span>
              );
            }
            const issue = seg.issue;
            const isSelected = selectedIssue?.id === issue.id;
            return (
              <span
                key={i}
                className={`docview-mark docview-mark--${issue.level} ${isSelected ? 'is-selected' : ''}`}
                onClick={() => handleIssueClick(issue)}
                title={issue.title}
              >
                {seg.text}
                <span className="docview-mark-tooltip">
                  <span className={`badge badge-${issue.level === 'critical' ? 'error' : issue.level === 'warning' ? 'warning' : 'neutral'}`}>
                    {issue.level === 'critical' ? '⚠ Critical' : issue.level === 'warning' ? '⚡ Warning' : 'ℹ Info'}
                  </span>
                  <span className="docview-mark-tooltip-title">{issue.title}</span>
                  <span className="docview-mark-tooltip-hint">Click for detailed analysis →</span>
                </span>
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
};
