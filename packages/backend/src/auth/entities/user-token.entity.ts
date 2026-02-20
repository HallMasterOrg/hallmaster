import { createZodDto } from 'nestjs-zod';
import { userTokenSchema } from '../schemas/user-token.schema.js';

export class UserTokenDto extends createZodDto(userTokenSchema) {}
