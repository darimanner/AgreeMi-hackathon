import React from 'react';
import { Bot, X } from 'lucide-react';
import { useAppStore } from '../../app/store';
import { AiAnalysisContent } from './AiAnalysisContent';

interface AiAnalysisDrawerProps {
  chatId: string;
  isOpen: boolean;
  onClose: () => void;
}

export const AiAnalysisDrawer: React.FC<AiAnalysisDrawerProps> = ({ chatId, isOpen, onClose }) => {
  const chatRooms = useAppStore(s => s.chatRooms);
  const room = chatRooms.find(r => r.id === chatId);
  const analysis = room?.aiAnalysis;

  // Prevent body scroll when open
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="ai-drawer-overlay" onClick={onClose}>
      <div
        className="ai-drawer animate-drawer-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="ai-drawer-header">
          <div className="flex items-center gap-2">
            <div className="sidebar-ai-icon"><Bot size={15} /></div>
            <div>
              <div className="sidebar-title">AI Analysis</div>
              <div className="text-xs text-muted">Powered by GPT-4o</div>
            </div>
          </div>
          <button className="ai-drawer-close" onClick={onClose} title="Close">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="ai-drawer-body">
          <AiAnalysisContent analysis={analysis} />
        </div>
      </div>
    </div>
  );
};
