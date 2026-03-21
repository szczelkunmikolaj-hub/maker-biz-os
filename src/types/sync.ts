import { KanbanStatus, Project } from './index';

/**
 * Derive kanbanStatus from project boolean flags.
 * Priority: shipped > paid > printed(finished) > printing prints > new-order
 */
export function deriveKanbanStatus(p: Pick<Project, 'printed' | 'paid' | 'sent' | 'prints'>): KanbanStatus {
  if (p.sent) return 'shipped';
  if (p.paid) return 'paid';
  if (p.printed) return 'finished';
  // Check if any print is actively printing
  const hasPrinting = (p.prints || []).some(pr => pr.status === 'printing');
  if (hasPrinting) return 'printing';
  return 'new-order';
}

/**
 * Apply boolean flags based on kanban column drop.
 */
export function applyKanbanStatus(status: KanbanStatus): Partial<Project> {
  switch (status) {
    case 'new-order':
      return { kanbanStatus: status, printed: false, paid: false, sent: false };
    case 'printing':
      return { kanbanStatus: status, printed: false, paid: false, sent: false };
    case 'finished':
      return { kanbanStatus: status, printed: true, paid: false, sent: false };
    case 'paid':
      return { kanbanStatus: status, printed: true, paid: true, sent: false };
    case 'shipped':
      return { kanbanStatus: status, printed: true, paid: true, sent: true };
    default:
      return { kanbanStatus: status };
  }
}
