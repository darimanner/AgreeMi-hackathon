import React, { useState } from 'react';
import { Bot, ChevronRight, ChevronLeft, GripVertical } from 'lucide-react';
import { useAppStore } from '../../app/store';
import { AiAnalysisContent } from './AiAnalysisContent';

interface AiAnalysisSidebarProps {
  chatId: string;
}

export const AiAnalysisSidebar: React.FC<AiAnalysisSidebarProps> = ({ chatId }) => {
  const chatRooms = useAppStore(s => s.chatRooms);
  const isSidebarOpen = useAppStore(s => s.isSidebarOpen);
  const toggleSidebar = useAppStore(s => s.toggleSidebar);
  const [sidebarWidth, setSidebarWidth] = useState(380);

  const room = chatRooms.find(r => r.id === chatId);
  const analysis = room?.aiAnalysis;

  const handleResizeStart = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = sidebarWidth;

    const handleResizeMove = (moveEvent: PointerEvent) => {
      const maxWidth = Math.min(window.innerWidth - 400, 800);
      const nextWidth = Math.min(Math.max(startWidth - (moveEvent.clientX - startX), 300), maxWidth);
      setSidebarWidth(nextWidth);
    };

    const handleResizeEnd = () => {
      window.removeEventListener('pointermove', handleResizeMove);
      window.removeEventListener('pointerup', handleResizeEnd);
    };

    window.addEventListener('pointermove', handleResizeMove);
    window.addEventListener('pointerup', handleResizeEnd, { once: true });
  };

  return (
    <aside
      className={`ai-sidebar desktop-only ${isSidebarOpen ? 'open' : 'closed'}`}
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
        <div className="sidebar-header">
          <div className="flex items-center gap-2">
            <div className="sidebar-ai-icon"><Bot size={15} /></div>
            <div>
              <div className="sidebar-title">AI Analysis</div>
              <div className="text-xs text-muted">Powered by GPT-4o</div>
            </div>
          </div>
        </div>
        
        <div className="sidebar-body-scroll">
          <AiAnalysisContent analysis={analysis} />
        </div>
      </div>
    </aside>
  );
};
