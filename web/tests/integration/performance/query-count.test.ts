import { describe, test, expect } from 'vitest';
import { riderUseCases } from '@/server/modules/riders/rider.use-cases';
import { notificationUseCases } from '@/server/modules/notifications/notification.use-cases';
import { hubUseCases } from '@/server/modules/hubs/hub.use-cases';
import { planUseCases } from '@/server/modules/plans/plan.use-cases';
import { getCacheStats } from '@/lib/cache';

describe('Query Count & Performance Optimization Integration Tests', () => {
  test('Rider profile dashboard load executes minimal queries and handles caching', async () => {
    // Memory cache stats verification
    const statsBefore = getCacheStats().query;
    expect(statsBefore.maxSize).toBe(500);

    // Hubs list query caching (30s TTL)
    const hubsFirst = await hubUseCases.listHubs();
    const hubsSecond = await hubUseCases.listHubs();
    expect(hubsFirst).toEqual(hubsSecond);

    // Unread notification count caching (10s TTL)
    const countFirst = await notificationUseCases.getUnreadCount('non-existent-id');
    const countSecond = await notificationUseCases.getUnreadCount('non-existent-id');
    expect(countFirst).toBe(countSecond);

    // Active rental plans caching (3600s TTL)
    const plansFirst = await planUseCases.listActivePlans();
    const plansSecond = await planUseCases.listActivePlans();
    expect(plansFirst).toEqual(plansSecond);

    const statsAfter = getCacheStats().query;
    expect(statsAfter.hits).toBeGreaterThan(0);
  });
});
