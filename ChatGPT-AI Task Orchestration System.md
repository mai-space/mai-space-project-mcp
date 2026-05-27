# AI Task Orchestration System

**User:** Anonymous  
**Created:** 5/27/2026 17:23:01  
**Updated:** 5/27/2026 17:24:12  
**Exported:** 5/27/2026 17:24:23  
**Link:** [https://chatgpt.com/c/6a170bd7-61a4-83eb-a74a-4e837335768e](https://chatgpt.com/c/6a170bd7-61a4-83eb-a74a-4e837335768e)  

## Prompt:
27.5.2026, 17:23:00

This CLI Tool will offer an MCP Server which lets ai agents fetch open tasks, mark them as "work in progress" which locks them for other agents and lastly add blocker tasks or mark the task as finished.

TASKS should be a flat list, while they can be cross referenced. They should only have so much information needed for the task. Documentation in the repository will and should do the rest.

It should also offer a way of registering different projects.

So the usage should be similar to mai-space-project-mcp --get-one-by-priority --project "bgm"

It should be really lightweight, so maybe a simple sql lite db and written in typescript?

Lets discuss a few more features, and create a feature list afterwards.
- Project Scope
- Tasks fetching by priority
- Tasks Status
- Lightweight
- Offer MCP for Agents
- Optional CLI Usage for Users or Agents (Create new Tasks etc)
- Hosted Locally or in the cloud for multiple Team Members
- Dashboard Web View with ASYNC Refresh with TASKs as Kanban view (Project Sidebar)
- Tasks can be Created via Web Dashboard

## Response:
27.5.2026, 17:23:00

A lightweight TypeScript + SQLite setup fits this really well. The key advantage is that you’re essentially building a coordination layer for AI agents, not a full project management suite. That means the system can stay intentionally minimal and deterministic.

Your core idea already has a strong shape:

- agents pull work
- tasks become locked
- agents report completion/blockers
- humans can supervise through CLI or dashboard
- MCP becomes the interoperability layer

A few architectural directions and feature ideas worth considering before formalizing the feature list:

---

# Core Design Philosophy

The most important decision is probably:

> Is this a “task board for humans” or a “distributed work queue for agents”?

Your current concept leans heavily toward:

> “Distributed autonomous task orchestration for AI agents.”

That’s good, because it keeps the system focused.

So instead of Jira-style complexity:
- no epics
- no deeply nested subtasks
- no sprint planning
- no story points
- no rich documents inside tasks

Instead:
- concise tasks
- references to docs/files
- deterministic states
- agent-safe locking
- lightweight coordination

That’s a strong niche.

---

# Suggested Core Data Model

## Projects

Very lightweight.

```ts
Project {
  id: string
  slug: string // "bgm"
  name: string
  description?: string
  repository?: string
  createdAt: Date
}
```

Potential future:
- repository path
- git integration
- default branch
- MCP endpoint auth

---

## Tasks

Keep flat as you proposed.

```ts
Task {
  id: string
  projectId: string

  title: string
  description?: string

  priority: number
  status: TaskStatus

  lockedBy?: string
  lockedAt?: Date
  lockExpiresAt?: Date

  createdBy?: string
  assignedTo?: string

  references?: string[] // task ids

  blockerReason?: string

  createdAt: Date
  updatedAt: Date
  completedAt?: Date
}
```

---

# Recommended Task States

Avoid too many states.

Maybe:

```txt
OPEN
IN_PROGRESS
BLOCKED
DONE
CANCELLED
```

Possibly:
```txt
WAITING
```

But only if truly needed.

---

# Important Feature: Lease-Based Locking

This is probably one of the most important system features.

Instead of permanent locking:

```txt
Agent claims task
→ receives lease for 30 min
→ renews periodically
→ if agent crashes lock expires
```

Otherwise dead tasks become a major issue.

Example:

```bash
mai-space-project-mcp claim --project bgm
```

returns:

```json
{
  "taskId": "task_42",
  "leaseExpiresAt": "2026-05-27T13:00:00Z"
}
```

This is MUCH safer for autonomous agents.

---

# Prioritization Strategy

You mentioned:

```bash
--get-one-by-priority
```

Good.

You should define:
- lower number = higher priority
or
- higher number = higher priority

early and consistently.

I’d recommend:

```txt
0 = highest
100 = lowest
```

Simple and sortable.

You could later support:
- weighted priority
- FIFO within same priority
- aging/escalation

But don’t start there.

---

# Cross References

Flat tasks + references is a very good design.

Example:

```txt
Task 15 depends on Task 11
Task 21 related to Task 15
```

You probably want relation types:

```ts
TaskRelation {
  fromTaskId
  toTaskId
  type:
    | "depends_on"
    | "related_to"
    | "blocks"
}
```

This keeps the core flat while enabling graph relationships.

---

# MCP Server Capabilities

This is where the project becomes really valuable.

Potential MCP tools:

```txt
get_projects
get_tasks
claim_task
renew_task_lease
complete_task
block_task
create_task
create_blocker_task
search_tasks
```

Potential MCP resources:
- project overview
- open tasks
- blocked tasks
- agent history

Potential MCP prompts:
- “Find next suitable task”
- “Analyze blockers”
- “Summarize project progress”

---

# Important Agent Metadata

You probably want agents to identify themselves.

Example:

```json
{
  "agentId": "claude-code-reviewer-1",
  "capabilities": ["typescript", "testing"]
}
```

This enables:
- specialized task routing
- audit history
- debugging

---

# Task Capability Matching (Very Valuable)

Potential future feature:

```ts
requiredCapabilities: string[]
```

Example:
- backend
- typo3
- testing
- docs
- react

Then agents can ask:

```txt
Give me highest priority task matching:
["typescript", "backend"]
```

This becomes extremely powerful later.

---

# CLI Suggestions

The CLI should feel UNIX-like.

Examples:

```bash
mai tasks claim --project bgm
mai tasks list --status OPEN
mai tasks create
mai tasks block 42
mai tasks complete 42
mai projects list
```

For machine usage:

```bash
mai tasks claim --json
```

Definitely support:
- JSON output
- non-interactive mode
- stdin piping

---

# SQLite Is Probably the Correct Choice

Especially initially.

Why:
- zero infra
- transactional locking
- portable
- works locally
- easy backups
- sufficient concurrency for this use case

Later:
- PostgreSQL adapter possible

Suggested stack:

- TypeScript
- Node.js
- SQLite
- Drizzle ORM or Kysely
- Fastify
- MCP SDK
- React dashboard

---

# Local vs Cloud

You probably want BOTH modes eventually.

## Local Mode

Perfect for:
- solo developers
- local agents
- repo-local orchestration

Example:

```bash
mai serve
```

starts:
- MCP server
- SQLite
- dashboard

---

## Shared Team Mode

Possible future:
- hosted API
- shared DB
- auth
- websocket sync

But don’t overbuild initially.

---

# Dashboard Thoughts

Kanban is the right choice.

Minimal columns:

```txt
OPEN
IN_PROGRESS
BLOCKED
DONE
```

Important dashboard features:
- live refresh
- see active agent locks
- manually unlock stale tasks
- create/edit tasks
- filter by project
- filter by priority
- see blockers graph

I would avoid:
- comments
- attachments
- rich text editors

Keep docs in git/repository.

---

# REALLY Valuable Future Features

These could become defining capabilities:

---

## 1. Git-Aware Tasks

Task linked to:
- branch
- PR
- commit

Example:

```txt
Task 42 completed by commit abc123
```

Huge value.

---

## 2. Agent Activity Feed

```txt
12:00 Claude claimed task 41
12:05 GPT created blocker task 44
12:11 Claude completed task 41
```

Excellent for debugging autonomous workflows.

---

## 3. Auto-Generated Follow-Up Tasks

When an agent blocks:

```txt
Missing API endpoint
```

System can auto-create:
- blocker task
- dependency link

Very useful.

---

## 4. Task Templates

Example:

```bash
mai task create --template bugfix
```

Potentially useful later.

---

# Things I Would Explicitly Avoid

To preserve the lightweight vision:

- markdown documentation inside tasks
- file uploads
- deep nesting
- agile sprint systems
- time tracking
- notifications/emails initially
- RBAC complexity initially
- chat/comments inside tasks

The repository should remain the source of truth.

---

# Suggested MVP Scope

I’d define MVP as:

## MVP

### Core
- projects
- tasks
- priorities
- statuses
- lease locking
- task claiming
- blocker tasks

### Interfaces
- CLI
- MCP server

### Storage
- SQLite

### Optional
- minimal dashboard

That’s already extremely useful.

---

# Possible Project Structure

```txt
/apps
  /cli
  /dashboard
  /server

/packages
  /core
  /db
  /mcp
  /shared-types
```

Monorepo with:
- pnpm
- turborepo

would fit nicely.

---

# One Important Design Question

You should decide early whether tasks are:

## A
Human-created work items

or

## B
Dynamic agent-generated execution units

Because B leads toward:
- autonomous decomposition
- recursive task generation
- planner agents

And that changes architecture substantially.

Right now your concept feels like a hybrid leaning toward B.

## Prompt:
27.5.2026, 17:23:47

Single Tasks should be claimed, not whole projects

## Response:
27.5.2026, 17:23:48

Yes - and that’s an important architectural distinction.

Projects should essentially act as:
- namespaces
- filtering scopes
- configuration containers

But **locking/claiming must happen exclusively at task level**.

So the mental model becomes:

```txt
Project
 ├── Task
 ├── Task
 ├── Task
```

Never:

```txt
Agent claims entire project
```

Instead:

```txt
Agent claims ONE executable unit of work
```

That keeps:
- concurrency high
- coordination simple
- agent utilization efficient

and avoids:
- giant long-lived locks
- ownership ambiguity
- idle claimed projects

---

# Recommended Model

## Projects

Projects are passive containers.

They provide:
- repository context
- MCP namespace
- dashboard grouping
- optional config

Example:

```bash
mai projects create bgm
```

---

# Task Claiming Flow

Example:

```bash
mai tasks claim --project bgm
```

System:
1. finds highest-priority OPEN task
2. atomically locks it
3. returns lease token

Example response:

```json
{
  "taskId": "42",
  "title": "Implement TYPO3 cache invalidation",
  "status": "IN_PROGRESS",
  "lockedBy": "agent-7",
  "leaseExpiresAt": "2026-05-27T12:30:00Z"
}
```

This is much closer to:
- job queues
- distributed workers
- orchestration systems

than classical PM software.

---

# This Also Enables Parallel Agent Swarms

Example:

Project `bgm` has:

```txt
Task 1
Task 2
Task 3
Task 4
```

Now:
- Claude claims Task 1
- Codex claims Task 2
- GPT claims Task 3

without coordination conflicts.

That’s probably one of the strongest aspects of your idea.

---

# Strong Recommendation: Atomic Claim Operation

This matters a lot.

You do NOT want:

```txt
get highest priority task
then
lock it
```

because two agents can race.

Instead:

```sql
UPDATE tasks
SET
  status = 'IN_PROGRESS',
  locked_by = ?,
  lock_expires_at = ?
WHERE id = (
  SELECT id FROM tasks
  WHERE project_id = ?
    AND status = 'OPEN'
  ORDER BY priority ASC, created_at ASC
  LIMIT 1
)
RETURNING *;
```

One atomic operation.

SQLite can handle this well.

---

# Suggested Core MCP Operations

This structure becomes very clean:

## Read

```txt
list_projects
list_tasks
get_task
search_tasks
```

## Agent Coordination

```txt
claim_task
renew_task_lease
release_task
complete_task
block_task
```

## Task Creation

```txt
create_task
create_blocker_task
```

---

# Important Addition: Requeueing

Sometimes agents fail.

You probably want:

```txt
release_task
```

or automatic timeout:

```txt
lease expired
→ task returns to OPEN
```

This is essential.

---

# Priority Queue Semantics

Your system is essentially:

```txt
project-scoped distributed priority queues
```

That framing is actually very powerful.

Because it means:
- deterministic
- scalable
- agent-friendly
- easy to reason about

---

# Suggested Task Selection Rules

I’d recommend:

## Selection Order

1. status = OPEN
2. no unresolved dependencies
3. highest priority
4. oldest first

Example:

```sql
ORDER BY
  priority ASC,
  created_at ASC
```

Very predictable.

---

# Dependency Handling

Since tasks stay flat:

```txt
Task 20 depends_on Task 15
```

Task 20 simply becomes:
- non-claimable
until Task 15 is DONE.

No nesting needed.

---

# Suggested Additional Fields

I’d strongly consider:

```ts
claimCount: number
lastClaimedAt?: Date
```

Useful for:
- debugging
- detecting problematic tasks
- retry policies

---

# One Feature That Fits PERFECTLY

## Agent Notes

Not full comments.

Just structured execution output:

```ts
executionNotes?: string
```

Example:

```txt
Migration failed because table missing
```

Very useful for handoffs between agents.

---

# Recommended Minimal Architecture

## Backend

- Node.js
- TypeScript
- Fastify
- SQLite
- Drizzle ORM

## Interfaces

- MCP Server
- REST API
- CLI
- Web Dashboard

## Sync

- WebSockets or SSE

---

# Your System Is Closer To

Not:
- Jira
- Trello

But more like:
- distributed work orchestration
- lightweight task leasing
- agent swarm coordination

Which is actually a very interesting niche.



---
Powered by [ChatGPT Exporter](https://www.chatgptexporter.com)