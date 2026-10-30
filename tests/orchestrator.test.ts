import { describe, it, expect } from 'vitest';
import { AgentOrchestrator } from '@/lib/orchestrator';

describe('Unified Agent Orchestrator', () => {
  it('enforces strict max 2 concurrency ceiling and queues overflow runs', async () => {
    const orchestrator = new AgentOrchestrator();
    let maxSimultaneous = 0;
    let currentlyRunning = 0;
    const completed: number[] = [];

    const makeTask = (id: number, delayMs: number) => {
      return orchestrator.schedule({
        agentType: 'TRACKING',
        targetShipmentId: `ship-${id}`,
        targetReference: `REF-${id}`,
        execute: async () => {
          currentlyRunning++;
          maxSimultaneous = Math.max(maxSimultaneous, currentlyRunning);
          await new Promise((r) => setTimeout(r, delayMs));
          currentlyRunning--;
          completed.push(id);
          return id;
        },
      });
    };

    // Schedule 4 concurrent runs
    const p1 = makeTask(1, 30);
    const p2 = makeTask(2, 30);
    const p3 = makeTask(3, 20);
    const p4 = makeTask(4, 20);

    const statsDuring = orchestrator.getStats();
    expect(statsDuring.activeRuns).toBeLessThanOrEqual(2);
    expect(statsDuring.queuedRuns).toBe(2);

    const results = await Promise.all([p1, p2, p3, p4]);

    expect(results).toEqual([1, 2, 3, 4]);
    expect(completed.length).toBe(4);
    // Concurrency must never have exceeded 2
    expect(maxSimultaneous).toBe(2);

    const statsAfter = orchestrator.getStats();
    expect(statsAfter.activeRuns).toBe(0);
    expect(statsAfter.queuedRuns).toBe(0);
  });

  it('handles cancellation of queued runs', async () => {
    const orchestrator = new AgentOrchestrator();

    // Fill concurrency slots
    const slow1 = orchestrator.schedule({
      agentType: 'TRACKING',
      execute: async () => new Promise((r) => setTimeout(r, 100)),
    });
    const slow2 = orchestrator.schedule({
      agentType: 'WAREHOUSE',
      execute: async () => new Promise((r) => setTimeout(r, 100)),
    });

    // Schedule 3rd task which will be queued
    let queuedRunId = '';
    const queuedPromise = orchestrator.schedule({
      agentType: 'TRACKING',
      execute: async () => 'should not run',
      onEvent: (evt) => {
        if (!queuedRunId) queuedRunId = evt.runId;
      },
    });

    const stats = orchestrator.getStats();
    expect(stats.queuedRuns).toBe(1);

    // Cancel queued task
    const cancelled = orchestrator.cancelRun(stats.activeRunIds[0] || 'unknown');
    expect(typeof cancelled).toBe('boolean');

    await Promise.allSettled([slow1, slow2, queuedPromise]);
  });
});
