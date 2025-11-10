import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsPositive, IsString } from 'class-validator';
import { Hypervisor } from '../../prisma/generated/enums.js';

export class Bot {
  @ApiProperty({
    description: 'The bot ID.',
  })
  @IsString()
  readonly id: string;

  @ApiProperty({
    description: 'The number of clusters allocated for the bot.',
  })
  @IsNumber()
  @IsPositive()
  readonly clusters: number;

  @ApiProperty({
    description: 'The total number of shards for the bot.',
  })
  @IsNumber()
  @IsPositive()
  readonly shards: number;

  @ApiProperty({
    description: "The hypervisor used to manage the bot's clusters.",
    enum: Hypervisor,
  })
  @IsEnum(Hypervisor)
  readonly hypervisor: Hypervisor;
}
