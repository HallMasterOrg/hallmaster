import { createZodDto } from 'nestjs-zod';
import { registerSchema } from '../schemas/register.schema.js';

export class RegisterDto extends createZodDto(registerSchema) {}
