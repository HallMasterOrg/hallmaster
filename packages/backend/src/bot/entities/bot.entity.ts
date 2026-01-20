import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsPositive, IsString } from 'class-validator';

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
}
