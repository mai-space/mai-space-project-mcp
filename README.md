# MAI Project MCP

A lightweight AI Agent Task Orchestration System. Manage tasks for autonomous agents via CLI, REST API, MCP Server, or Web Dashboard.

## Architecture

```
mai-space-project-mcp/
├── packages/
│   ├── shared-types/    # TypeScript interfaces (Project, Task, Agent, etc.)
│   ├── db/              # SQLite database via Kysely (schema, queries, migrations)
│   ├── core/            # Business logic (orchestrator, claim, complete, block, lease)
│   └── mcp/             # MCP server (tools, resources, prompts for AI agents)
├── apps/
│   ├── server/          # Fastify REST API + MCP SSE transport
│   ├── cli/             # Command-line interface
│   └── dashboard/       # React Kanban web dashboard
└── install.sh           # One-time install script
```

## Quick Start

```bash
# Install
curl -fsSL https://raw.githubusercontent.com/mai-space/mai-space-project-mcp/main/scripts/install.sh | bash

# Or from source:
npm install
npx tsc -b
```

## Usage

### CLI

```bash
# Create a project
mai projects create my-project "My Project"
mai projects list

# Create a task
mai tasks create my-project "Implement feature X" --priority 30

# Claim and complete
mai tasks claim my-project --by agent-1
mai tasks complete <task-id> --by agent-1

# Block a task
mai tasks block <task-id> --by agent-1 --reason "Waiting for dependency"

# Search tasks
mai tasks search "feature" --project my-project

# Output as JSON
mai tasks list --json
```

### REST API

```bash
# Start the server
mai serve --port 3456

# API endpoints:
GET    /api/projects                     # List projects
POST   /api/projects                     # Create project
GET    /api/projects/:slug               # Get project
POST   /api/projects/:slug/tasks         # Create task
GET    /api/projects/:slug/tasks         # List tasks
GET    /api/projects/:slug/tasks/:id     # Get task
POST   /api/projects/:slug/tasks/claim   # Claim next task
POST   /api/tasks/:id/complete           # Complete a task
POST   /api/tasks/:id/block              # Block a task
POST   /api/tasks/:id/release            # Release a task
GET    /health                           # Health check
```

### MCP Server

The MCP Server exposes task orchestration to AI agents (Claude, Cursor, etc.):

```json
{
  "mcpServers": {
    "mai": {
      "url": "http://localhost:3456/mcp"
    }
  }
}
```

**Tools**: `list_projects`, `create_project`, `list_tasks`, `create_task`, `claim_task`, `complete_task`, `block_task`, `release_task`, `renew_lease`, `create_blocker_task`, `search_tasks`, `register_agent`, `get_task`, `list_dependencies`

**Resources**: `projects://list`, `projects://{slug}/tasks`, `tasks://{id}`

**Prompts**: `task-orchestrator-hire`, `task-creator`, `task-resolver`

### Web Dashboard

```bash
mai serve
# Open http://localhost:3456
```

Or standalone:
```bash
cd apps/dashboard && npm run dev
# http://localhost:5173
```

## Task Lifecycle

```
OPEN ──[claim]──> IN_PROGRESS ──[complete]──> DONE
                      │
                    [block]
                      │
                      v
                  BLOCKED ──[release]──> OPEN
```

- **Lease**: Tasks are leased to agents with a TTL (default 5 minutes). Renew to extend.
- **Priority**: Lower values = higher priority. Used for task ordering in claims.
- **Blockers**: Create blocker tasks that automatically block their parent.

## Packages

| Package | Description |
|---------|-------------|
| `@mai-space/shared-types` | TypeScript interfaces and types |
| `@mai-space/db` | SQLite database layer (Kysely ORM) |
| `@mai-space/core` | Business logic orchestrator |
| `@mai-space/mcp` | Model Context Protocol server |
| `@mai-space/server` | Fastify HTTP server |
| `@mai-space/cli` | Command-line interface |
| `@mai-space/dashboard` | React web dashboard |

## Development

```bash
# Build all packages
npx tsc -b

# Build specific package
npx tsc -b packages/db
npx tsc -b packages/core

# Watch mode
npx tsc -b --watch

# Clean
npx tsc -b --clean
```

## Configuration

Environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `MAI_DB_PATH` | `./mai.db` | SQLite database path |
| `PORT` | `3456` | Server port |
| `HOST` | `localhost` | Server host |
