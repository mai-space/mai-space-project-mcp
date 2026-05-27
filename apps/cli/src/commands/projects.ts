import type { Command } from 'commander';

export function registerProjectCommands(program: Command, createOrchestrator: () => import('@mai-space/core').TaskOrchestrator) {
  const projects = program.command('projects').description('Manage projects');

  projects
    .command('list')
    .description('List projects')
    .option('--slug <slug>', 'Filter by slug')
    .action(async (opts) => {
      const orch = createOrchestrator();
      const projects = await orch.listProjects(opts.slug);
      if (program.opts().json) {
        console.log(JSON.stringify(projects, null, 2));
      } else {
        console.table(projects.map((p) => ({ slug: p.slug, name: p.name, description: p.description ?? '' })));
      }
    });

  projects
    .command('create')
    .description('Create a project')
    .argument('<slug>', 'Project slug')
    .argument('<name>', 'Project name')
    .option('--description <desc>', 'Project description')
    .option('--repository <url>', 'Repository URL')
    .action(async (slug, name, opts) => {
      const orch = createOrchestrator();
      const project = await orch.createProject({ slug, name, description: opts.description ?? null, repository: opts.repository ?? null });
      if (program.opts().json) {
        console.log(JSON.stringify(project, null, 2));
      } else {
        console.log(`Project created: ${project.slug} (${project.id})`);
      }
    });
}
