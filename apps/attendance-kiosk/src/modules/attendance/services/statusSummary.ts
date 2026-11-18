import type { AttendanceRepository } from '@face/offline-sync';

export interface StatusSummary {
  pending: number;
  synced: number;
  rejected: number;
}

export async function loadStatusSummary(
  repo: AttendanceRepository,
): Promise<StatusSummary> {
  const [pending, synced, rejected] = await Promise.all([
    repo.countByStatus('PENDING'),
    repo.countByStatus('SYNCED'),
    repo.countByStatus('REJECTED'),
  ]);
  return { pending, synced, rejected };
}
