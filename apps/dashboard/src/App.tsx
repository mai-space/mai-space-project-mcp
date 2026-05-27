import { useState, useEffect, useCallback } from 'react';
import type { Project, Task } from './api.js';
import { listProjects, listTasks, createTask, claimTask, completeTask, blockTask, releaseTask } from './api.js';
import ProjectSidebar from './components/ProjectSidebar.js';
import KanbanBoard from './components/KanbanBoard.js';
import CreateTaskModal from './components/CreateTaskModal.js';
import './App.css';

const POLL_INTERVAL = 5000;
const AGENT_ID = `dashboard-${Date.now()}`;

export default function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [justClaimed, setJustClaimed] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    try {
      const list = await listProjects();
      setProjects(list);
      if (!activeProject && list.length > 0) {
        setActiveProject(list[0]);
      }
    }       catch {}
  }, [activeProject]);

  const fetchTasks = useCallback(async () => {
    if (!activeProject) return;
    try {
      const list = await listTasks(activeProject.slug);
      setTasks(list);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load tasks');
    }
  }, [activeProject]);

  useEffect(() => { fetchProjects(); }, []);
  useEffect(() => { fetchTasks(); const id = setInterval(fetchTasks, POLL_INTERVAL); return () => clearInterval(id); }, [fetchTasks]);

  const handleSelectProject = (p: Project) => setActiveProject(p);

  const handleCreateTask = async (title: string, description: string | null, priority: number) => {
    if (!activeProject) return;
    try {
      await createTask(activeProject.slug, { title, description, priority });
      await fetchTasks();
      setShowCreate(false);
      notify('Task created');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create task');
    }
  };

  const handleClaimTask = async (taskId: string) => {
    if (!activeProject) return;
    try {
      await claimTask(activeProject.slug, AGENT_ID);
      setJustClaimed(taskId);
      await fetchTasks();
      notify('Task claimed');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to claim task');
    }
  };

  const handleCompleteTask = async (taskId: string) => {
    try {
      await completeTask(taskId, AGENT_ID);
      await fetchTasks();
      notify('Task completed');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to complete task');
    }
  };

  const handleReleaseTask = async (taskId: string) => {
    try {
      await releaseTask(taskId, AGENT_ID);
      await fetchTasks();
      notify('Task released');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to release task');
    }
  };

  const handleBlockTask = async (taskId: string, reason: string) => {
    try {
      await blockTask(taskId, AGENT_ID, reason);
      await fetchTasks();
      notify('Task blocked');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to block task');
    }
  };

  const notify = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 2000);
  };

  const showNotification = notification || (justClaimed && `Claimed a new task!`);

  return (
    <div className="app">
      <header className="app-header">
        <h1>MAI Task Orchestrator</h1>
        <div className="app-header-info">
          <span className="agent-id">Agent: {AGENT_ID.substring(0, 20)}…</span>
          <button className="btn btn-sm" onClick={() => { setJustClaimed(null); fetchTasks(); }}>Refresh</button>
        </div>
      </header>
      <div className="app-body">
        <ProjectSidebar
          projects={projects}
          activeProject={activeProject}
          onSelect={handleSelectProject}
          onCreateProject={() => { setShowCreate(true); }}
        />
        <main className="main-content">
          {error && <div className="error-banner">{error}<button onClick={() => setError(null)}>×</button></div>}
          {showNotification && <div className="notification">{showNotification}</div>}
          {activeProject ? (
            <>
              <div className="board-header">
                <h2>{activeProject.name}</h2>
                <div className="board-actions">
                  <button className="btn" onClick={() => setShowCreate(true)}>+ New Task</button>
                </div>
              </div>
              <KanbanBoard
                tasks={tasks}
                onClaim={handleClaimTask}
                onComplete={handleCompleteTask}
                onRelease={handleReleaseTask}
                onBlock={handleBlockTask}
                agentId={AGENT_ID}
              />
            </>
          ) : (
            <div className="empty-state">
              <p>No project selected. Create or select a project to get started.</p>
            </div>
          )}
        </main>
      </div>
      {showCreate && (
        <CreateTaskModal
          onClose={() => setShowCreate(false)}
          onCreate={handleCreateTask}
        />
      )}
    </div>
  );
}
