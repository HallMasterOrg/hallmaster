import { createZodDto } from "nestjs-zod";
import z from "zod";

const GetBotSchema = z.object({
  id: z.string().meta({
    description: "The bot ID.",
  }),
  clusters: z.number().positive().default(1).optional().meta({
    description: "The number of clusters allocated for the bot.",
  }),
  shards: z.number().positive().default(1).optional().meta({
    description: "The number of shards allocated for the bot.",
  }),
});

export class GetBotDto extends createZodDto(GetBotSchema) {}
