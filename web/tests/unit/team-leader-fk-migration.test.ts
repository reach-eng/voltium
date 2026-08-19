import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '@/lib/db';
import { teamLeaderRepository } from '@/server/modules/team-leaders/team-leader.repository';

// Mock the database client
vi.mock('@/lib/db', () => ({
  db: {
    teamLeader: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    rider: {
      groupBy: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

describe('Team Leader FK Migration - Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('teamLeaderRepository.findAllPaginated', () => {
    it('should query rider counts using teamLeaderId instead of the legacy teamLeader string', async () => {
      // Setup mocks
      const mockLeaders = [
        { id: 'tl-1', name: 'Leader 1' },
        { id: 'tl-2', name: 'Leader 2' },
      ];
      
      vi.mocked(db.teamLeader.findMany).mockResolvedValue(mockLeaders as any);
      vi.mocked(db.teamLeader.count).mockResolvedValue(2);
      vi.mocked(db.rider.groupBy).mockResolvedValue([
        { teamLeaderId: 'tl-1', _count: 5 },
        { teamLeaderId: 'tl-2', _count: 10 },
      ] as any);

      // Execute
      const result = await teamLeaderRepository.findAllPaginated({
        page: 1,
        limit: 10,
      });

      // Verify groupBy query uses teamLeaderId
      expect(db.rider.groupBy).toHaveBeenCalledWith({
        by: ['teamLeaderId'],
        where: { teamLeaderId: { in: ['tl-1', 'tl-2'], not: null } },
        _count: true,
      });

      // Verify the counts were properly mapped to the leaders
      expect(result.leaders[0].riderCount).toBe(5);
      expect(result.leaders[1].riderCount).toBe(10);
    });

    it('should return 0 count when groupBy returns empty', async () => {
      // Setup mocks
      const mockLeaders = [{ id: 'tl-3', name: 'Leader 3' }];
      
      vi.mocked(db.teamLeader.findMany).mockResolvedValue(mockLeaders as any);
      vi.mocked(db.teamLeader.count).mockResolvedValue(1);
      vi.mocked(db.rider.groupBy).mockResolvedValue([] as any);

      // Execute
      const result = await teamLeaderRepository.findAllPaginated({
        page: 1,
        limit: 10,
      });

      // Verify the fallback count is 0
      expect(result.leaders[0].riderCount).toBe(0);
    });
  });
});
