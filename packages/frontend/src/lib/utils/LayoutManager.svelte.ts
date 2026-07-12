import type { GetClusterDto, UpdateBotDto } from "@hallmaster/backend/dto";

class Cluster {
  public current: Set<number>;
  public readonly previous: Set<number>;
  public shards = $state<Map<number, "unchanged" | "deleted" | "moved" | "added">>();
  public state = $state<"unchanged" | "changed" | "deleted" | "added">("unchanged");

  constructor(
    private readonly manager: LayoutManager,
    shards: NonNullable<typeof this.shards>,
    public readonly id?: GetClusterDto["id"],
  ) {
    const ids = shards.keys().toArray();
    this.current = new Set(ids);

    if (id === undefined) {
      this.previous = new Set();
      this.state = "added";
    } else this.previous = new Set(ids);

    this.shards = shards;
  }

  public update() {
    const unchanged = this.current.intersection(this.previous);
    const deleted = this.previous.difference(this.current);
    const moved = this.manager.clusters
      .filter((cluster) => cluster !== this)
      .map((cluster) => cluster.previous.intersection(this.current))
      .flatMap((set) => Array.from(set));
    const added = this.current.difference(new Set([...unchanged, ...moved]));

    const entries = [
      ...unchanged.values().map((id) => [id, "unchanged"] as const),
      ...deleted.values().map((id) => [id, "deleted"] as const),
      ...moved.map((id) => [id, "moved"] as const),
      ...added.values().map((id) => [id, "added"] as const),
    ].sort((a, b) => a[0] - b[0]);

    this.shards = new Map(entries);

    if (this.current.size === 0) this.state = "deleted";
    else if (this.previous.size === 0) this.state = "added";
    else if (deleted.size + moved.length + added.size !== 0) this.state = "changed";
    else this.state = "unchanged";
  }

  public add() {
    this.current.add(this.manager.maxShardId + 1);
    this.update();
  }

  public pop(update: boolean = true) {
    const id = Math.max(...this.current);
    this.current.delete(id);

    for (const cluster of this.manager.clusters) {
      cluster.decrement(id);
      if (update) cluster.update();
    }
  }

  public decrement(id: GetClusterDto["shardIds"][number]) {
    this.current = new Set(this.current.values().map((shard) => (shard > id ? shard - 1 : shard)));
  }

  public clear() {
    while (this.current.size) this.pop(false);

    for (const cluster of this.manager.clusters) cluster.update();
  }
}

export class LayoutManager {
  public clusters: Cluster[];

  constructor(private readonly data: Omit<GetClusterDto, "status">[]) {
    this.clusters = $state(
      this.data.map(
        ({ id, shardIds }) =>
          new Cluster(this, new Map(shardIds.map((id) => [id, "unchanged"])), id),
      ),
    );
  }

  public get maxShardId(): number {
    return Math.max(...this.clusters.flatMap(({ current }) => Array.from(current)), -1);
  }

  public add(length: number = 1) {
    const max = this.maxShardId + 1;
    this.clusters.push(
      new Cluster(this, new Map(Array.from({ length }).map((_, index) => [max + index, "added"]))),
    );
  }

  public remove(index: number) {
    const cluster = this.clusters[index];
    const isAdded = cluster.state === "added";

    cluster.clear();
    if (isAdded) this.clusters.splice(index, 1);
  }

  public reset() {
    this.clusters = this.data.map(
      ({ id, shardIds }) => new Cluster(this, new Map(shardIds.map((id) => [id, "unchanged"])), id),
    );
  }

  public export(): NonNullable<UpdateBotDto["layout"]> {
    return this.clusters
      .filter((cluster) => cluster.state !== "deleted")
      .map(({ id, current }) => ({ id, shardIds: Array.from(current) }));
  }
}
