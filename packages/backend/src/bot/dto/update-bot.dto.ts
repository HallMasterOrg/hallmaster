import { PartialType } from '@nestjs/swagger';
import { CreateBotDto } from './create-bot.dto.js';

export class UpdateBotDto extends PartialType(CreateBotDto) {}
