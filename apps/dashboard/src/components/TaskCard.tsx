import { useState } from 'react';
import type { Task } from '../api.js';

interface Props {
  task: Task;
  onClaim: (taskId: string) => void;
  onComplete: (taskId: string) => void;
  onRelease: (taskId: string) => void;
  onBlock: (taskId: string, reason: string) => void;
  agentId: string;
}

export default function TaskCard({ task, onClaim, onComplete, onRelease, onBlock, agentId }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [blockReason, setBlockReason] = useState('');

  const isAssignedToMe = task.lockedBy === agentId;
  const canClaim = task.status === 'OPEN';
  const canComplete = task.status === 'IN_PROGRESS' && isAssignedToMe;
  const canRelease = (task.status === 'IN_PROGRESS' || task.status === 'BLOCKED') && isAssignedToMe;
  const canBlock = task.status === 'IN_PROGRESS' && isAssignedToMe;

  return (
    <div
      className={`task-card ${task.status.toLowerCase()}`}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="task-card-header">
        <span className={`priority priority-${task.priority <= 25 ? 'high' : task.priority <= 50 ? 'medium' : 'low'}`}>
          P{task.priority}
        </span>
        <span className="task-card-title">{task.title}</span>
      </div>
      {task.lockedBy && <div className="task-card-agent">🔒 {task.lockedBy.substring(0, 12)}…</div>}
      {task.blockerReason && <div className="task-card-blocker">⛔ {task.blockerReason}</div>}

      {expanded && (
        <div className="task-card-actions" onClick={(e) => e.stopPropagation()}>
          {canClaim && <button className="btn btn-sm btn-primary" onClick={() => onClaim(task.id)}>Claim</button>}
          {canComplete && <button className="btn btn-sm btn-success" onClick={() => onComplete(task.id)}>Complete</button>}
          {canRelease && <button className="btn btn-sm" onClick={() => onRelease(task.id)}>Release</button>}
          {canBlock && (
            <div className="block-form">
              <input
                type="text"
                placeholder="Block reason"
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
              />
              <button
                className="btn btn-sm btn-danger"
                disabled={!blockReason}
                onClick={() => onBlock(task.id, blockReason)}
              >
                Block
              </button>
            </div>
          )}
          <div className="task-card-detail">ID: {task.id.substring(0, 8)}…</div>
          {task.description && <div className="task-card-detail">{task.description}</div>}
          {task.leaseExpiresAt && <div className="task-card-detail">Lease: {new Date(task.leaseExpiresAt).toLocaleTimeString()}</div>}
        </div>
      )}
    </div>
  );
}
