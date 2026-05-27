import type { Task } from '../api.js';
import KanbanColumn from './KanbanColumn.js';

interface Props {
  tasks: Task[];
  onClaim: (taskId: string) => void;
  onComplete: (taskId: string) => void;
  onRelease: (taskId: string) => void;
  onBlock: (taskId: string, reason: string) => void;
  agentId: string;
}

const COLUMNS = [
  { key: 'OPEN', label: 'Open' },
  { key: 'IN_PROGRESS', label: 'In Progress' },
  { key: 'BLOCKED', label: 'Blocked' },
  { key: 'DONE', label: 'Done' },
];

export default function KanbanBoard({ tasks, onClaim, onComplete, onRelease, onBlock, agentId }: Props) {
  return (
    <div className="kanban-board">
      {COLUMNS.map((col) => {
        const columnTasks = tasks.filter((t) => t.status === col.key);
        return (
          <KanbanColumn
            key={col.key}
            title={col.label}
            status={col.key}
            tasks={columnTasks}
            onClaim={onClaim}
            onComplete={onComplete}
            onRelease={onRelease}
            onBlock={onBlock}
            agentId={agentId}
          />
        );
      })}
    </div>
  );
}
