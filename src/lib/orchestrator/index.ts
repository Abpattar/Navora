import { EventEmitter } from 'node:events';
import {
  createAgentRun,
  updateAgentRun,
  appendAgentEvent,
} from '@/lib/db';
import type { AgentRun, AgentType } from '@/lib/types';

export interface OrchestratorEvent {
  type: 'STARTED' | 'STREAMING_URL' | 'PROGRESS' | 'HEARTBEAT' | 'COMPLETE' | 'FAILED' | 'LOG' | 'STATUS_CHANGE';
  runId: string;
  data: Record<string, unknown>;
  timestamp: string;
}

export interface EnqueuedAgentTask<T = unknown> {
  runId: string;
  agentType: AgentType;
  targetShipmentId?: string;
  targetReference?: string;
  enqueuedAt: number;
  execute: (signal: AbortSignal, emitEvent: (type: OrchestratorEvent['type'], data: Record<string, unknown>) => void) => Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
  controller: AbortController;
  timeoutMs: number;
}

export class AgentOrchestrator extends EventEmitter {
  private static readonly MAX_CONCURRENCY = 2; // Strict global ceiling: max 2 active TinyFish runs
  private activeCount = 0;
  private activeTasks: Map<string, EnqueuedAgentTask<unknown>> = new Map();
  private waitQueue: Array<EnqueuedAgentTask<unknown>> = [];

  constructor() {
    super();
    this.setMaxListeners(200);
  }

  /**
   * Current stats for observability and inspector dashboard
   */
  public getStats() {
    return {
      activeRuns: this.activeCount,
      maxConcurrency: AgentOrchestrator.MAX_CONCURRENCY,
      queuedRuns: this.waitQueue.length,
      activeRunIds: Array.from(this.activeTasks.keys()),
    };
  }

  /**
   * Schedule and execute an agent task governed by the global 2-run concurrency ceiling
   */
  public async schedule<T>(params: {
    agentType: AgentType;
    targetShipmentId?: string;
    targetReference?: string;
    timeoutMs?: number;
    execute: (signal: AbortSignal, emitEvent: (type: OrchestratorEvent['type'], data: Record<string, unknown>) => void) => Promise<T>;
    onEvent?: (event: OrchestratorEvent) => void;
  }): Promise<T> {
    const runId = `run-${params.agentType.toLowerCase()}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const timeoutMs = params.timeoutMs ?? (params.agentType === 'WAREHOUSE' ? 120000 : 90000);
    const controller = new AbortController();

    // Attach external event listener if provided
    if (params.onEvent) {
      const listener = (evt: OrchestratorEvent) => {
        if (evt.runId === runId) {
          params.onEvent?.(evt);
        }
      };
      this.on('event', listener);
      // Remove listener once settled
      const cleanup = () => this.off('event', listener);
      controller.signal.addEventListener('abort', cleanup, { once: true });
    }

    // Persist initial record in SQLite
    const startTime = new Date().toISOString();
    try {
      createAgentRun({
        id: crypto.randomUUID(),
        runId,
        agentType: params.agentType,
        targetShipmentId: params.targetShipmentId,
        targetReference: params.targetReference,
        status: 'RUNNING',
        startTime,
        stepsCount: 0,
      });
    } catch (err) {
      console.warn('[Orchestrator] Failed to persist initial agent run to DB:', err);
    }

    return new Promise<T>((resolve, reject) => {
      const task: EnqueuedAgentTask<T> = {
        runId,
        agentType: params.agentType,
        targetShipmentId: params.targetShipmentId,
        targetReference: params.targetReference,
        enqueuedAt: Date.now(),
        execute: params.execute as (signal: AbortSignal, emitEvent: (type: OrchestratorEvent['type'], data: Record<string, unknown>) => void) => Promise<T>,
        resolve,
        reject,
        controller,
        timeoutMs,
      };

      this.waitQueue.push(task as EnqueuedAgentTask<unknown>);
      this.emitState();
      this.drainNext();
    });
  }

  /**
   * Cancel an ongoing or queued agent run
   */
  public cancelRun(runId: string, reason = 'Cancelled by operator'): boolean {
    // Check if in wait queue
    const queueIdx = this.waitQueue.findIndex((t) => t.runId === runId);
    if (queueIdx !== -1) {
      const [cancelled] = this.waitQueue.splice(queueIdx, 1);
      cancelled.reject(new Error(reason));
      try {
        updateAgentRun(runId, {
          status: 'FAILED',
          endTime: new Date().toISOString(),
          error: reason,
        });
      } catch { /* ignore */ }
      this.emitState();
      return true;
    }

    // Check if active
    const active = this.activeTasks.get(runId);
    if (active) {
      active.controller.abort();
      active.reject(new Error(reason));
      this.activeTasks.delete(runId);
      this.activeCount = Math.max(0, this.activeCount - 1);
      try {
        updateAgentRun(runId, {
          status: 'FAILED',
          endTime: new Date().toISOString(),
          error: reason,
        });
      } catch { /* ignore */ }
      this.emitState();
      this.drainNext();
      return true;
    }

    return false;
  }

  private drainNext() {
    if (this.activeCount >= AgentOrchestrator.MAX_CONCURRENCY) {
      return;
    }

    const task = this.waitQueue.shift();
    if (!task) {
      return;
    }

    this.activeCount++;
    this.activeTasks.set(task.runId, task);
    this.emitState();

    this.runTask(task);
  }

  private async runTask(task: EnqueuedAgentTask<unknown>) {
    const { runId, execute, resolve, reject, controller, timeoutMs } = task;
    let timer: NodeJS.Timeout | null = null;

    const emitEvent = (type: OrchestratorEvent['type'], data: Record<string, unknown>) => {
      const timestamp = new Date().toISOString();
      const evt: OrchestratorEvent = { type, runId, data, timestamp };

      // Record in agent_events
      try {
        appendAgentEvent({
          id: crypto.randomUUID(),
          runId,
          type: type as any,
          timestamp,
          message: String(data.purpose || data.message || type),
          payload: data,
        });
      } catch { /* ignore */ }

      // Forward to subscribers
      this.emit('event', evt);
      this.emit(`event:${runId}`, evt);
    };

    try {
      timer = setTimeout(() => {
        controller.abort();
      }, timeoutMs);

      emitEvent('STARTED', {
        message: `Agent execution started (${task.agentType}). Slot acquired from concurrency manager.`,
        targetShipmentId: task.targetShipmentId,
        targetReference: task.targetReference,
      });

      const result = await execute(controller.signal, emitEvent);

      if (timer) clearTimeout(timer);

      try {
        updateAgentRun(runId, {
          status: 'COMPLETED',
          endTime: new Date().toISOString(),
        });
      } catch { /* ignore */ }

      resolve(result);
    } catch (err: unknown) {
      if (timer) clearTimeout(timer);
      const isTimeout = controller.signal.aborted;
      const message = isTimeout
        ? `Agent execution timed out after ${timeoutMs / 1000}s`
        : err instanceof Error
        ? err.message
        : 'Agent run encountered an unknown failure';

      emitEvent('FAILED', {
        error: message,
        isTimeout,
      });

      try {
        updateAgentRun(runId, {
          status: 'FAILED',
          endTime: new Date().toISOString(),
          error: message,
        });
      } catch { /* ignore */ }

      reject(err);
    } finally {
      this.activeTasks.delete(runId);
      this.activeCount = Math.max(0, this.activeCount - 1);
      this.emitState();
      this.drainNext();
    }
  }

  private emitState() {
    this.emit('state', this.getStats());
  }
}

// Global Singleton to ensure instance-wide strict 2-run ceiling
declare global {
  // eslint-disable-next-line no-var
  var __globalAgentOrchestrator: AgentOrchestrator | undefined;
}

export const agentOrchestrator = globalThis.__globalAgentOrchestrator || new AgentOrchestrator();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__globalAgentOrchestrator = agentOrchestrator;
}
