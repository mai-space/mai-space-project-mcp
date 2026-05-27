import type { Command } from 'commander';

export function registerTaskCommands(program: Command, createOrchestrator: () => import('@mai-space/core').TaskOrchestrator) {
  const tasks = program.command('tasks').description('Manage tasks');

  tasks
    .command('list')
    .description('List tasks')
    .option('--project <slug>', 'Project slug')
    .option('--status <status>', 'Status filter')
    .option('--limit <n>', 'Max results')
    .option('--offset <n>', 'Result offset')
    .action(async (opts) => {
      const orch = createOrchestrator();
      let projectId: string | undefined;
      if (opts.project) {
        const project = await orch.getProject(opts.project);
        projectId = project.id;
      }
      const tasks = await orch.listTasks({ projectId, status: opts.status, limit: opts.limit ? Number(opts.limit) : undefined, offset: opts.offset ? Number(opts.offset) : undefined });
      if (program.opts().json) {
        console.log(JSON.stringify(tasks, null, 2));
      } else {
        console.table(tasks.map((t) => ({ id: t.id.substring(0, 8), title: t.title.substring(0, 40), status: t.status, priority: t.priority, agent: t.lockedBy ?? '' })));
      }
    });

  tasks
    .command('get')
    .description('Get task details')
    .argument('<id>', 'Task ID')
    .action(async (id) => {
      const orch = createOrchestrator();
      const task = await orch.getTask(id);
      if (program.opts().json) {
        console.log(JSON.stringify(task, null, 2));
      } else {
        console.log(`Task: ${task.title}`);
        console.log(`  ID:       ${task.id}`);
        console.log(`  Status:   ${task.status}`);
        console.log(`  Priority: ${task.priority}`);
        console.log(`  Project:  ${task.projectId}`);
        console.log(`  LockedBy: ${task.lockedBy ?? 'none'}`);
        if (task.description) console.log(`  Desc:     ${task.description}`);
        if (task.blockerReason) console.log(`  Blocker:  ${task.blockerReason}`);
      }
    });

  tasks
    .command('create')
    .description('Create a task')
    .argument('<projectSlug>', 'Project slug')
    .argument('<title>', 'Task title')
    .option('--description <desc>', 'Task description')
    .option('--priority <n>', 'Priority (lower = higher)', '50')
    .option('--by <agent>', 'Creator agent ID')
    .action(async (projectSlug, title, opts) => {
      const orch = createOrchestrator();
      const project = await orch.getProject(projectSlug);
      const task = await orch.createTask({ projectId: project.id, title, description: opts.description ?? null, priority: Number(opts.priority), createdBy: opts.by ?? null });
      if (program.opts().json) {
        console.log(JSON.stringify(task, null, 2));
      } else {
        console.log(`Task created: ${task.id} - ${task.title}`);
      }
    });

  tasks
    .command('search')
    .description('Search tasks')
    .argument('<query>', 'Search query')
    .option('--project <slug>', 'Project slug')
    .option('--status <status>', 'Status filter')
    .option('--limit <n>', 'Max results')
    .action(async (query, opts) => {
      const orch = createOrchestrator();
      let projectId: string | undefined;
      if (opts.project) {
        const project = await orch.getProject(opts.project);
        projectId = project.id;
      }
      const tasks = await orch.searchTasks(query, projectId, opts.status, opts.limit ? Number(opts.limit) : undefined);
      if (program.opts().json) {
        console.log(JSON.stringify(tasks, null, 2));
      } else {
        console.table(tasks.map((t) => ({ id: t.id.substring(0, 8), title: t.title.substring(0, 40), status: t.status })));
      }
    });

  tasks
    .command('claim')
    .description('Claim a task')
    .argument('<projectSlug>', 'Project slug')
    .requiredOption('--by <agentId>', 'Agent identifier')
    .option('--capabilities <csv>', 'Comma-separated capabilities')
    .action(async (projectSlug, opts) => {
      const orch = createOrchestrator();
      const project = await orch.getProject(projectSlug);
      const capabilities = opts.capabilities ? opts.capabilities.split(',').map((s: string) => s.trim()) : undefined;
      const result = await orch.claimTask(project.id, opts.by, capabilities);
      if (program.opts().json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(`Claimed task: ${result.title} (lease expires ${result.leaseExpiresAt.toISOString()})`);
      }
    });

  tasks
    .command('complete')
    .description('Complete a task')
    .argument('<id>', 'Task ID')
    .requiredOption('--by <agentId>', 'Agent identifier')
    .option('--notes <text>', 'Execution notes')
    .action(async (id, opts) => {
      const orch = createOrchestrator();
      const task = await orch.completeTask(id, opts.by, opts.notes);
      if (program.opts().json) {
        console.log(JSON.stringify(task, null, 2));
      } else {
        console.log(`Task ${id} completed`);
      }
    });

  tasks
    .command('block')
    .description('Block a task')
    .argument('<id>', 'Task ID')
    .requiredOption('--by <agentId>', 'Agent identifier')
    .requiredOption('--reason <text>', 'Block reason')
    .action(async (id, opts) => {
      const orch = createOrchestrator();
      const task = await orch.blockTask(id, opts.by, opts.reason);
      if (program.opts().json) {
        console.log(JSON.stringify(task, null, 2));
      } else {
        console.log(`Task ${id} blocked: ${opts.reason}`);
      }
    });

  tasks
    .command('release')
    .description('Release a task')
    .argument('<id>', 'Task ID')
    .requiredOption('--by <agentId>', 'Agent identifier')
    .action(async (id, opts) => {
      const orch = createOrchestrator();
      const task = await orch.releaseTask(id, opts.by);
      if (program.opts().json) {
        console.log(JSON.stringify(task, null, 2));
      } else {
        console.log(`Task ${id} released`);
      }
    });

  tasks
    .command('renew')
    .description('Renew a task lease')
    .argument('<id>', 'Task ID')
    .requiredOption('--by <agentId>', 'Agent identifier')
    .action(async (id, opts) => {
      const orch = createOrchestrator();
      const result = await orch.renewLease(id, opts.by);
      if (program.opts().json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(`Lease renewed for task ${id}: ${result.renewed}`);
      }
    });

  tasks
    .command('blocker')
    .description('Create a blocker task')
    .argument('<projectSlug>', 'Project slug')
    .argument('<title>', 'Blocker task title')
    .requiredOption('--blocks <taskId>', 'Task ID to block')
    .requiredOption('--by <agentId>', 'Agent identifier')
    .option('--description <desc>', 'Blocker description')
    .action(async (projectSlug, title, opts) => {
      const orch = createOrchestrator();
      const project = await orch.getProject(projectSlug);
      const result = await orch.createBlockerTask({ projectId: project.id, title, description: opts.description ?? null, blockedTaskId: opts.blocks, createdBy: opts.by });
      if (program.opts().json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(`Blocker task ${result.blocker.id} created, blocking ${result.original.id}`);
      }
    });
}
