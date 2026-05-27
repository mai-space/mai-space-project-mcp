import type { Project } from '../api.js';

interface Props {
  projects: Project[];
  activeProject: Project | null;
  onSelect: (p: Project) => void;
  onCreateProject: () => void;
}

export default function ProjectSidebar({ projects, activeProject, onSelect, onCreateProject }: Props) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h3>Projects</h3>
        <button className="btn btn-xs" onClick={onCreateProject}>+</button>
      </div>
      <ul className="project-list">
        {projects.map((p) => (
          <li
            key={p.id}
            className={`project-item ${activeProject?.id === p.id ? 'active' : ''}`}
            onClick={() => onSelect(p)}
          >
            <span className="project-name">{p.name}</span>
            <span className="project-slug">{p.slug}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
