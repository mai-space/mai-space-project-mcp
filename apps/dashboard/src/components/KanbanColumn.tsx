import type { Task } from '../api.js';
import TaskCard from './TaskCard.js';

interface Props {
  title: string;
  status: string;
  tasks: Task[];
  onClaim: (taskId: string) => void;
  onComplete: (taskId: string) => void;
  onRelease: (taskId: string) => void;
  onBlock: (taskId: string, reason: string) => void;
  agentId: string;
}

export default function KanbanColumn({ title, status, tasks, onClaim, onComplete, onRelease, onBlock, agentId }: Props) {
  return (
    <div className="kanban-column" data-status={status}>
      <div className="column-header">
        <h3>{title}</h3>
        <span className="column-count">{tasks.length}</span>
      </div>
      <div className="column-body">
        {tasks.length === 0 && <div className="column-empty">No tasks</div>}
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onClaim={onClaim}
            onComplete={onComplete}
            onRelease={onRelease}
            onBlock={onBlock}
            agentId={agentId}
          />
        ))}
      </div>
    </div>
  );
}
