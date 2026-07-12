export { ApiErrorSchema, type ApiErrorDto } from './common/dto/api-error.dto.js';

export { registerSchema, type Register } from './auth/schemas/register.schema.js';
export { loginSchema } from './auth/schemas/login.schema.js';
export { type UserToken } from './auth/schemas/user-token.schema.js';

export { CreateBotSchema, type CreateBotDto } from './bot/dto/create-bot.dto.js';
export { UpdateBotSchema, type UpdateBotDto } from './bot/dto/update-bot.dto.js';
export { GetBotSchema, type GetBotDto } from './bot/dto/get-bot.dto.js';
export { GetRecommendedShardsSchema, type GetRecommendedShardsDto } from './bot/dto/get-recommended-shards.dto.js';

export { SseIntervalQuerySchema } from './clusters/dto/sse-interval-query.dto.js';
export { ClusterIdParamSchema, type ClusterIdParamDto } from './clusters/dto/cluster-id-param.dto.js';
export { GetClusterSchema, type GetClusterDto } from './clusters/dto/get-cluster.dto.js';
export {
  GetClusterLogsQuerySchema,
  GetClusterLogsSchema,
  type GetClusterLogsQueryDto,
  type GetClusterLogsDto,
} from './clusters/dto/get-cluster-logs.dto.js';
export { GetClusterStatsSchema, type GetClusterStatsDto } from './clusters/dto/get-cluster-stats.dto.js';
export { type GetAggregateStatsDto } from './clusters/dto/get-aggregate-stats.dto.js';
