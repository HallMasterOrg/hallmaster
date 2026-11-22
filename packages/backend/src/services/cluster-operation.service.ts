import type { ClusterId } from "#schemas/cluster.schema";

const SETTLE_DELAY = 1_000;

export default class ClusterOperationService {
  private static readonly ongoing = new Map<ClusterId, number>();
  private static readonly settledAt = new Map<ClusterId, number>();

  public static async run<T>(ids: ClusterId[], operation: () => Promise<T>) {
    for (const id of ids) {
      this.ongoing.set(id, (this.ongoing.get(id) ?? 0) + 1);
    }

    try {
      return await operation();
    } finally {
      const now = Date.now();
      for (const id of ids) {
        const remaining = (this.ongoing.get(id) ?? 1) - 1;
        if (remaining === 0) this.ongoing.delete(id);
        else this.ongoing.set(id, remaining);

        this.settledAt.set(id, now);
      }
    }
  }

  public static isBusy(id: ClusterId, at = Date.now()) {
    if (this.ongoing.has(id)) return true;

    const settledAt = this.settledAt.get(id);

    return settledAt !== undefined && at - settledAt < SETTLE_DELAY;
  }
}
