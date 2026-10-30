import { EventEmitter } from 'node:events';
import { getCarrier } from '@/lib/carriers';
import { lookupShipmentWithTinyFish, TinyFishLookupError } from '@/lib/tinyfish/client';
import { saveTrackingObservation, getShipment } from '@/lib/db';
import type { CarrierId, ShipmentResult, ShipmentStatus, ShipmentTracking } from '@/lib/types';

export interface QueueTask {
  id: string;
  shipmentId: string;
  trackingNumber: string;
  carrier: CarrierId;
  status: 'queued' | 'running' | 'completed' | 'failed';
  enqueuedAt: number;
  startedAt?: number;
  completedAt?: number;
  result?: ShipmentResult;
  error?: string;
}

class TrackingQueueManager extends EventEmitter {
  private queue: QueueTask[] = [];
  private runningCount = 0;
  private readonly MAX_CONCURRENT = 2; // Strict limit: 2 agent runs max

  constructor() {
    super();
    this.setMaxListeners(100);
  }

  public enqueue(items: Array<{ shipmentId: string; carrier: CarrierId; trackingNumber: string }>): QueueTask[] {
    const tasks: QueueTask[] = items.map((item) => ({
      id: `task-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      shipmentId: item.shipmentId,
      trackingNumber: item.trackingNumber,
      carrier: item.carrier,
      status: 'queued',
      enqueuedAt: Date.now(),
    }));

    this.queue.push(...tasks);
    this.emit('enqueued', { count: tasks.length });
    this.processNext();
    return tasks;
  }

  public getStats() {
    const queued = this.queue.filter((t) => t.status === 'queued').length;
    const running = this.runningCount;
    const completed = this.queue.filter((t) => t.status === 'completed').length;
    const failed = this.queue.filter((t) => t.status === 'failed').length;
    return { queued, running, completed, failed, total: this.queue.length };
  }

  public getTasks(): QueueTask[] {
    return [...this.queue];
  }

  public clearQueue() {
    this.queue = this.queue.filter((t) => t.status === 'running');
  }

  private async processNext() {
    if (this.runningCount >= this.MAX_CONCURRENT) {
      return;
    }

    const nextTask = this.queue.find((t) => t.status === 'queued');
    if (!nextTask) {
      return;
    }

    this.runningCount++;
    nextTask.status = 'running';
    nextTask.startedAt = Date.now();
    this.emit('task_started', nextTask);

    try {
      const carrierConfig = getCarrier(nextTask.carrier);
      if (!carrierConfig) {
        throw new Error(`Carrier ${nextTask.carrier} is not supported`);
      }

      const result = await lookupShipmentWithTinyFish({
        carrier: carrierConfig,
        trackingNumber: nextTask.trackingNumber,
      });

      nextTask.status = 'completed';
      nextTask.completedAt = Date.now();
      nextTask.result = result;

      // Map to database tracking observation
      const rawStatus = result.status || result.latestEvent || '';
      let currentStatus: ShipmentStatus = 'UNKNOWN';
      if (/delivered/i.test(rawStatus)) {
        currentStatus = 'DELIVERED';
      } else if (/customs/i.test(rawStatus)) {
        currentStatus = 'CUSTOMS_HOLD';
      } else if (/terminal|discharged|arrived/i.test(rawStatus)) {
        currentStatus = 'ARRIVED_AT_TERMINAL';
      } else if (/delayed|held|exception/i.test(rawStatus)) {
        currentStatus = 'DELAYED';
      } else if (result.lookupStatus === 'success') {
        currentStatus = 'IN_TRANSIT';
      }

      const isDelayed = currentStatus === 'DELAYED' || /delay|late/i.test(result.warnings.join(' '));

      const trackingRecord: ShipmentTracking = {
        id: crypto.randomUUID(),
        shipmentId: nextTask.shipmentId,
        trackingNumber: nextTask.trackingNumber,
        carrier: nextTask.carrier,
        carrierName: carrierConfig.name,
        lookupStatus: result.lookupStatus,
        currentStatus,
        rawStatus: result.status,
        currentLocation: result.location,
        liveEta: result.estimatedArrival,
        isDelayed,
        latestMilestone: result.latestEvent,
        lastFreeDate: result.lastFreeDate,
        eventDate: result.eventDate,
        sourceUrl: result.sourceUrl,
        retrievedAt: result.retrievedAt,
        milestones: result.milestones,
        warnings: result.warnings,
        errorMessage: result.errorMessage,
      };

      saveTrackingObservation(trackingRecord);
      this.emit('task_completed', { task: nextTask, result: trackingRecord });
    } catch (err: unknown) {
      nextTask.status = 'failed';
      nextTask.completedAt = Date.now();
      const message = err instanceof TinyFishLookupError ? err.message : (err instanceof Error ? err.message : 'Lookup failed');
      nextTask.error = message;
      this.emit('task_failed', { task: nextTask, error: message });
    } finally {
      this.runningCount--;
      // Immediately pull next item from queue
      this.processNext();
    }
  }
}

// Global Singleton to ensure max 2 concurrent runs across application instance
declare global {
  // eslint-disable-next-line no-var
  var __globalTrackingQueue: TrackingQueueManager | undefined;
}

export const trackingQueue = globalThis.__globalTrackingQueue || new TrackingQueueManager();
if (process.env.NODE_ENV !== 'production') {
  globalThis.__globalTrackingQueue = trackingQueue;
}
