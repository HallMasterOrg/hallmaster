import { afterEach, describe, expect, it, vi } from "vitest";

import ClusterOperationService from "#services/cluster-operation.service";

function pending() {
  let finish = () => {};
  const promise = new Promise<void>((resolve) => (finish = resolve));

  return { promise, finish };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("cluster operations", () => {
  it("refuses a second operation on a busy cluster and lets the others run", async () => {
    const first = pending();
    const running = ClusterOperationService.run([0], () => first.promise);

    await expect(ClusterOperationService.run([0, 1], async () => {})).rejects.toMatchObject({
      status: 409,
      message: "Cluster 0 is busy with another operation, retry once it is done",
    });
    await expect(ClusterOperationService.run([1], () => Promise.resolve("done"))).resolves.toBe(
      "done",
    );

    first.finish();
    await running;
    await expect(ClusterOperationService.run([0], () => Promise.resolve("done"))).resolves.toBe(
      "done",
    );
  });

  it("keeps layout operations apart from cluster operations", async () => {
    const cluster = pending();
    const running = ClusterOperationService.run([2], () => cluster.promise);

    await expect(ClusterOperationService.runOnLayout(async () => {})).rejects.toMatchObject({
      status: 409,
      message: "Another operation is running on the clusters, retry once it is done",
    });
    cluster.finish();
    await running;

    const layout = pending();
    const deploying = ClusterOperationService.runOnLayout(() => layout.promise);

    await expect(ClusterOperationService.run([5], async () => {})).rejects.toMatchObject({
      status: 409,
      message: "The clusters are being updated, retry once it is done",
    });
    layout.finish();
    await deploying;
  });

  it("runs the operations nested in a held one", async () => {
    const result = ClusterOperationService.runOnLayout(() =>
      ClusterOperationService.run([0], () =>
        ClusterOperationService.runOnLayout(() => Promise.resolve("nested")),
      ),
    );

    await expect(result).resolves.toBe("nested");
  });

  it("keeps a cluster busy for a second after its operation", async () => {
    vi.useFakeTimers();
    vi.advanceTimersByTime(1_000);

    await ClusterOperationService.run([3], async () => {});

    expect(ClusterOperationService.isBusy(3)).toBe(true);
    expect(ClusterOperationService.isBusy(4)).toBe(false);
    vi.advanceTimersByTime(1_000);
    expect(ClusterOperationService.isBusy(3)).toBe(false);
  });
});
