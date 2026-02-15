import { createZodDto } from 'nestjs-zod';
import { createdUserSchema } from '../schemas/created-user.schema.js';

export class CreatedUserDto extends createZodDto(createdUserSchema) {}
