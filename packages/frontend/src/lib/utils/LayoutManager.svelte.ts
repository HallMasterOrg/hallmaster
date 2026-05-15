import type { GetClusterDto, UpdateBotDto } from "@hallmaster/backend/dto";

class Shard {
  public id: GetClusterDto["shardIds"][number];
  public mutation: "unchanged" | "added" | "deleted" | "moved";

  constructor(id: typeof this.id, mutation: typeof this.mutation = "unchanged") {
    this.id = $state(id);
    this.mutation = $state(mutation);
  }
}

class Cluster {
  public readonly shards: Shard[];
  public mutation: "unchanged" | "added" | "deleted" = $state("unchanged");

  constructor(
    private readonly manager: LayoutManager,
    shards: Shard[],
    public readonly id?: number,
  ) {
    this.shards = $state(shards);
  }

  private findById(id: GetClusterDto["shardIds"][number]) {
    const index = this.shards.findIndex((shard) => shard.id === id && shard.mutation !== "deleted");

    return {
      index,
      shard: index !== -1 ? this.shards[index] : undefined,
    };
  }

  public add() {
    this.shards.push(new Shard(this.manager.maxShardId + 1, "added"));
  }

  public remove(id: GetClusterDto["shardIds"][number]) {
    const { shard, index } = this.findById(id);
    if (!shard) return;

    if (shard.mutation === "added") this.shards.splice(index, 1);
    else {
      shard.id = 0;
      shard.mutation = "deleted";
    }

    for (const shard of this.manager.shards) if (shard.id > id) shard.id--;
  }

  public move(id: GetClusterDto["shardIds"][number], cluster: number) {
    const { shard, index } = this.findById(id);
    if (!shard) return;

    shard.mutation = "moved";
    this.manager.clusters[cluster].shards.push(this.shards.splice(index, 1)[0]);
  }
}

export class LayoutManager {
  public clusters: Cluster[] = $state([]);

  constructor(data: Omit<GetClusterDto, "status">[]) {
    this.clusters = data
      .map(
        (cluster) =>
          new Cluster(
            this,
            cluster.shardIds.map((id) => new Shard(id)),
            cluster.id,
          ),
      )
      .sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
  }

  public get maxShardId(): number {
    return Math.max(
      ...this.clusters.flatMap((cluster) => cluster.shards.map((shard) => shard.id)),
      -1,
    );
  }

  public get shards(): Shard[] {
    return this.clusters.flatMap((cluster) => cluster.shards);
  }

  public add() {
    const cluster = new Cluster(this, [new Shard(this.maxShardId + 1, "added")]);
    cluster.mutation = "added";

    this.clusters.push(cluster);
  }

  public remove(index: number) {
    const cluster = this.clusters[index];

    for (const { id } of cluster.shards.toReversed()) cluster.remove(id);

    if (cluster.mutation === "added") this.clusters.splice(index, 1);
    else cluster.mutation = "deleted";
  }

  public export(): NonNullable<UpdateBotDto["layout"]> {
    return this.clusters
      .filter((cluster) => cluster.mutation !== "deleted")
      .map((cluster) => ({
        id: cluster.id,
        shardIds: cluster.shards
          .filter((shard) => shard.mutation !== "deleted")
          .map((shard) => shard.id),
      }));
  }
}
