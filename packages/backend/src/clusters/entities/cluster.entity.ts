import type { UUID } from 'node:crypto';
import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsEnum, IsUUID } from 'class-validator';
import { ClusterStatus } from '../../prisma/generated/enums.js';

export class Cluster {
  @ApiProperty({
    description: 'The cluster ID.',
  })
  @IsUUID()
  readonly id: UUID;

  @ApiProperty({
    description: 'The shard IDs associated to that cluster.',
    isArray: true,
    type: 'number',
  })
  @IsArray()
  readonly shardIds: number[];

  @ApiProperty({
    description: 'The current status of the cluster.',
  })
  @IsEnum(ClusterStatus)
  readonly status: number;
}
