import { ExecutionEvent } from './types.js';

export class ExecutionTrace {
  private events: ExecutionEvent[] = [];

  record(event: ExecutionEvent) {
    this.events.push(event);
  }

  list() {
    return [...this.events];
  }

  summary() {
    const statusCount = this.events.reduce<Record<string, number>>((acc, event) => {
      acc[event.status] = (acc[event.status] ?? 0) + 1;
      return acc;
    }, {});

    return {
      total: this.events.length,
      statusCount,
      lastEvent: this.events[this.events.length - 1] ?? null,
    };
  }
}
