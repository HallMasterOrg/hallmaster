import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { CreateBotSchema } from './create-bot.dto.js';

export const UpdateBotSchema = CreateBotSchema.partial();

export class UpdateBotZodDto extends createZodDto(UpdateBotSchema) {}

export type UpdateBotDto = z.infer<typeof UpdateBotSchema>;
