import { createZodDto } from 'nestjs-zod';

import { loginSchema } from '../schemas/login.schema.js';

export class LoginDto extends createZodDto(loginSchema) {}
