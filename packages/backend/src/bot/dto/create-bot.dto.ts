import { IsNumber, IsOptional, IsPositive } from 'class-validator';
import {
  FileSystemStoredFile,
  HasMimeType,
  IsFile,
  MaxFileSize,
} from 'nestjs-form-data';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBotDto {
  @ApiProperty({
    description: 'The number of clusters allocated for the bot.',
    default: 1,
  })
  @Transform(({ value }) => parseInt(value as string, 10))
  @IsNumber()
  @IsPositive()
  readonly clusters: number;

  @ApiPropertyOptional({
    description: 'The total number of shards for the bot.',
    default: 1,
  })
  @Transform(({ value }) =>
    value === null || value === '0' ? undefined : parseInt(value as string, 10),
  )
  @IsOptional()
  @IsNumber()
  @IsPositive()
  readonly shards?: number;

  @ApiPropertyOptional({
    description:
      'The source code of the bot, contained in a zip file. If omitted, the Docker image from the given registry will be used instead.',
    type: String,
    format: 'binary',
  })
  @IsOptional()
  @IsFile()
  @MaxFileSize(10_000_000) // 10mb
  @HasMimeType(['application/zip'])
  readonly sourceCode?: FileSystemStoredFile;
}
