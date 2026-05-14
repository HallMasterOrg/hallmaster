import { createZodDto } from 'nestjs-zod';

import { userTokenDataSchema } from '../schemas/user-token-data.schema.js';

export class UserTokenDataDto extends createZodDto(userTokenDataSchema) {}
