import { createZodDto } from "nestjs-zod";
import { CreateBotSchema } from "./create-bot.dto.js";

export class UpdateBotDto extends createZodDto(CreateBotSchema.partial()) {}
