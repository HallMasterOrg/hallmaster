import { AsyncLocalStorage } from "node:async_hooks";

import { ConflictException } from "#exceptions/http-exceptions";
import type { ClusterId } from "#schemas/cluster.schema";

const SETTLE_DELAY = 1_000;
const LAYOUT = "layout";

type Key = ClusterId | typeof LAYOUT;

export default class ClusterOperationService {
  private static readonly locked = new Set<Key>();
  private static readonly settledAt = new Map<Key, number>();
  private static readonly holder = new AsyncLocalStorage<true>();

  private static conflict(keys: Key[]) {
    if (keys.includes(LAYOUT)) {
      return this.locked.size > 0
        ? "Another operation is running on the clusters, retry once it is done"
        : null;
    }

    if (this.locked.has(LAYOUT)) {
      return "The clusters are being updated, retry once it is done";
    }

    const busy = keys.find((key) => this.locked.has(key));

    return busy === undefined
      ? null
      : `Cluster ${busy} is busy with another operation, retry once it is done`;
  }

  private static acquire(keys: Key[]) {
    if (this.holder.getStore()) return () => {};

    const message = this.conflict(keys);
    if (message !== null) throw new ConflictException({ message });

    for (const key of keys) {
      this.locked.add(key);
    }

    return () => {
      const now = Date.now();
      for (const key of keys) {
        this.locked.delete(key);
        this.settledAt.set(key, now);
      }
    };
  }

  private static async hold<T>(keys: Key[], operation: () => Promise<T>) {
    const release = this.acquire(keys);

    try {
      return await this.holder.run(true, operation);
    } finally {
      release();
    }
  }

  public static async run<T>(ids: ClusterId[], operation: () => Promise<T>) {
    return this.hold(ids, operation);
  }

  public static async runOnLayout<T>(operation: () => Promise<T>) {
    return this.hold([LAYOUT], operation);
  }

  public static isBusy(id: ClusterId, at = Date.now()) {
    if (this.locked.has(LAYOUT) || this.locked.has(id)) return true;

    const keys: Key[] = [id, LAYOUT];

    return keys.some((key) => {
      const settledAt = this.settledAt.get(key);

      return settledAt !== undefined && at - settledAt < SETTLE_DELAY;
    });
  }
}
