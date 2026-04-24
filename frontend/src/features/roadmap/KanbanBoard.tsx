import React, { useState } from 'react';
import { Plus, MoreHorizontal, Zap, ArrowLeft, Flag, Clock } from 'lucide-react';
import { useAppStore } from '../../app/store';
import type { KanbanTask } from '../../shared/types';
import './kanban.css';

const COLUMNS = [
  { id: 'backlog',     label: 'Backlog',     color: '#515a4f' },
  { id: 'todo',        label: 'To Do',       color: '#38bdf8' },
  { id: 'in-progress', label: 'In Progress', color: 'var(--color-lime-400)' },
  { id: 'done',        label: 'Done',        color: 'var(--color-success)' },
] as const;

const PRIORITY_COLORS = {
  high:   { dot: '#ff4d4d', badge: 'badge-error' },
  medium: { dot: '#f59e0b', badge: 'badge-warning' },
  low:    { dot: '#38bdf8', badge: 'badge-neutral' },
};

const TaskCard: React.FC<{ task: KanbanTask; onDrop: (col: KanbanTask['column']) => void }> = ({ task }) => {
  const pc = PRIORITY_COLORS[task.priority];
  return (
    <div className="kanban-card glass animate-kanban">
      {/* Priority indicator */}
      <div className="kanban-card-priority">
        <span className="kanban-priority-dot" style={{ background: pc.dot }} />
        <span className={`badge ${pc.badge}`} style={{ fontSize: 10 }}>
          <Flag size={9} />
          {task.priority}
        </span>
      </div>

      <h4 className="kanban-card-title">{task.title}</h4>
      <p className="kanban-card-desc">{task.description}</p>

      <div className="kanban-card-footer">
        <div className="kanban-tags">
          {task.tags.map(tag => (
            <span key={tag} className="kanban-tag">{tag}</span>
          ))}
        </div>
        <div className="kanban-estimate">
          <Clock size={11} />
          {task.estimate}
        </div>
      </div>
    </div>
  );
};

export const KanbanBoard: React.FC = () => {
  const kanbanTasks = useAppStore(s => s.kanbanTasks);
  const setAppState = useAppStore(s => s.setAppState);
  const updateTaskColumn = useAppStore(s => s.updateTaskColumn);
  const [dragTask, setDragTask] = useState<string | null>(null);

  const tasksByCol = (col: KanbanTask['column']) =>
    kanbanTasks.filter(t => t.column === col);

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); };
  const handleDrop = (e: React.DragEvent, col: KanbanTask['column']) => {
    e.preventDefault();
    if (dragTask) updateTaskColumn(dragTask, col);
    setDragTask(null);
  };

  return (
    <div className="kanban-page animate-fade-in">
      {/* Top bar */}
      <div className="kanban-topbar">
        <div className="kanban-topbar-left">
          <div className="kanban-logo">
            <Zap size={18} />
            <span>ReqLens</span>
          </div>
          <div className="kanban-breadcrumb">
            <span>example-spec.pdf</span>
            <span className="kanban-breadcrumb-sep">/</span>
            <span className="kanban-breadcrumb-active">Roadmap</span>
          </div>
        </div>

        <div className="kanban-topbar-right">
          <span className="badge badge-lime">
            <Zap size={10} />
            AI-сгенерировано
          </span>
          <span className="badge badge-neutral">{kanbanTasks.length} задач</span>
          <button className="btn btn-ghost" style={{ padding: '8px 14px', fontSize: 13 }} onClick={() => setAppState('review')}>
            <ArrowLeft size={14} />
            Вернуться к анализу
          </button>
          <button className="btn btn-primary" style={{ padding: '8px 16px', fontSize: 13 }}>
            <Plus size={14} />
            Экспорт в Jira
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="kanban-stats">
        {COLUMNS.map(col => {
          const count = tasksByCol(col.id as KanbanTask['column']).length;
          return (
            <div key={col.id} className="kanban-stat-item">
              <span className="kanban-stat-dot" style={{ background: col.color }} />
              <span className="kanban-stat-label">{col.label}</span>
              <span className="kanban-stat-count">{count}</span>
            </div>
          );
        })}
      </div>

      {/* Board */}
      <div className="kanban-board">
        {COLUMNS.map(col => {
          const tasks = tasksByCol(col.id as KanbanTask['column']);
          return (
            <div
              key={col.id}
              className="kanban-column"
              onDragOver={handleDragOver}
              onDrop={e => handleDrop(e, col.id as KanbanTask['column'])}
            >
              {/* Column header */}
              <div className="kanban-col-header">
                <div className="kanban-col-title">
                  <span className="kanban-col-dot" style={{ background: col.color }} />
                  <span>{col.label}</span>
                  <span className="kanban-col-count">{tasks.length}</span>
                </div>
                <button className="btn-icon" style={{ width: 28, height: 28 }}>
                  <MoreHorizontal size={14} />
                </button>
              </div>

              {/* Cards */}
              <div className="kanban-cards">
                {tasks.map((task, idx) => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={() => setDragTask(task.id)}
                    style={{ animationDelay: `${idx * 60}ms` }}
                  >
                    <TaskCard task={task} onDrop={(c) => updateTaskColumn(task.id, c)} />
                  </div>
                ))}

                {tasks.length === 0 && (
                  <div className="kanban-empty">
                    <span>Перетащите сюда</span>
                  </div>
                )}
              </div>

              {/* Add task */}
              <button className="kanban-add-btn">
                <Plus size={14} />
                Добавить задачу
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
