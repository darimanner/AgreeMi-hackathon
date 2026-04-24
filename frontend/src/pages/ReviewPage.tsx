import React from 'react';
import { Zap, ArrowLeft } from 'lucide-react';
import { DocumentViewer } from '../features/analyzer/DocumentViewer';
import { ChatPanel } from '../features/chat/ChatPanel';
import { useAppStore } from '../app/store';
import './review.css';

export const ReviewPage: React.FC = () => {
  const setAppState = useAppStore(s => s.setAppState);
  const document = useAppStore(s => s.document);
  const generateRoadmap = useAppStore(s => s.generateRoadmap);

  return (
    <div className="review-layout">
      {/* Top nav */}
      <div className="review-nav">
        <div className="review-nav-left">
          <div className="review-nav-logo">
            <div className="review-nav-logo-icon">
              <Zap size={14} />
            </div>
            <span>ReqLens</span>
          </div>
          <div className="review-nav-divider" />
          <span className="review-nav-title">Анализ ТЗ</span>
          {document && (
            <div className="review-nav-pills">
              <span className="badge badge-error">{document.stats.criticalIssues} критических</span>
              <span className="badge badge-warning">{document.stats.warnings} предупреждений</span>
            </div>
          )}
        </div>

        <div className="review-nav-right">
          <button className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => setAppState('upload')}>
            <ArrowLeft size={13} />
            Новый документ
          </button>
          <button className="btn btn-primary" style={{ padding: '8px 18px', fontSize: 13 }} onClick={generateRoadmap}>
            <Zap size={14} />
            Сгенерировать Roadmap
          </button>
        </div>
      </div>

      {/* Main split */}
      <div className="review-split">
        {/* Left pane: document */}
        <div className="review-left">
          <DocumentViewer />
        </div>

        {/* Right pane: chat */}
        <div className="review-right">
          <ChatPanel />
        </div>
      </div>
    </div>
  );
};
