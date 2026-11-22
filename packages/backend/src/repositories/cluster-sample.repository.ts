import prisma from "#lib/database";
import type { ClusterSample } from "#prisma/client";

export type ClusterSampleBucket = Pick<
  ClusterSample,
  "clusterId" | "at" | "cpuPercentage" | "memoryPercentage"
> & { memoryUsage: number };

export default class ClusterSampleRepository {
  public static async createMany(data: ClusterSample[]) {
    return prisma.clusterSample.createMany({ data, skipDuplicates: true });
  }

  public static async deleteManyBefore(date: Date) {
    return prisma.clusterSample.deleteMany({ where: { at: { lt: date } } });
  }

  public static async findManyBuckets(botId: ClusterSample["botId"], since: Date, seconds: number) {
    return prisma.$queryRaw<ClusterSampleBucket[]>`
      SELECT
        "cluster_id" AS "clusterId",
        date_bin(make_interval(secs => ${seconds}), "at", ${since}) AS "at",
        avg("cpu_percentage")::float8 AS "cpuPercentage",
        avg("memory_usage")::float8 AS "memoryUsage",
        avg("memory_percentage")::float8 AS "memoryPercentage"
      FROM "cluster_sample"
      WHERE "bot_id" = ${botId} AND "at" >= ${since}
      GROUP BY 1, 2
      ORDER BY 1, 2
    `;
  }
}
