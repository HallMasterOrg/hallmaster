import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { GetClusterStatsSchema } from './get-cluster-stats.dto.js';

export const GetAggregateStatsSchema = z.record(z.coerce.number().int().nonnegative(), GetClusterStatsSchema).meta({
  description: 'Stats of every running cluster, keyed by cluster ID. Clusters whose stats failed to fetch are omitted.',
});

export class GetAggregateStatsZodDto extends createZodDto(GetAggregateStatsSchema) {}

export type GetAggregateStatsDto = z.infer<typeof GetAggregateStatsSchema>;
