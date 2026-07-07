import { TasksPage } from '../tasks/TasksPage';

// Solo athlete's task board: the full coach tasks page in self mode — create,
// prioritize, categorize, complete, and get AI suggestions for your own player.
export function SoloTasksPage() {
  return <TasksPage self />;
}
