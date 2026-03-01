# Milestone Lifecycle

Milestones provide a way to group related tasks and track collective progress toward a goal.

## What Milestones Solve

- **Goal tracking**: Group tasks that contribute to a shared objective
- **Progress visibility**: See completion percentage across multiple tasks
- **Planning**: Organize work into logical delivery units

## Milestone Operations

### Creating Milestones
Use `createMilestone({ title, description })` to create a new milestone. The system generates a unique ID and creates a markdown file at `backlog/milestones/m-{id}-{slug}.md`.

### Assigning Tasks
Tasks can be assigned to milestones by setting the `milestone` field. When a task is assigned:
1. The task's `milestone` field is updated
2. The milestone's `tasks[]` array is synchronized to include the task ID

### Unassigning Tasks
When a task's milestone changes or the task is deleted:
1. The old milestone's `tasks[]` array is updated to remove the task ID
2. The task's `milestone` field reflects the new state

### Tracking Progress
`MilestoneBucket` provides:
- `doneCount`: Number of completed tasks
- `total`: Total tasks in the milestone
- `progress`: Percentage complete

### Updating Milestones
Use `updateMilestone(id, { title?, description?, tasks? })` to modify milestone properties.

### Deleting Milestones
`deleteMilestone(id)` removes the milestone file. Tasks keep their `milestone` field but become orphaned (no matching milestone exists).

## Common Workflows

1. **Sprint planning**: Create a milestone for each sprint, assign tasks
2. **Feature development**: Group all tasks for a feature under one milestone
3. **Release tracking**: Track progress toward a release with multiple features
