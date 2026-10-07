import z from "zod";
import { ClusterSchema } from "./cluster.schema";

export const ContainerImageSchema = z.object({
  url: z.string().meta({
    description: "URL of the container image (example: ghcr.io/repo/image:tag)",
  }),
  username: z.string().optional().meta({
    description: "Username used to authenticate to the container registry",
  }),
  password: z.string().optional().meta({
    description: "Password used to authenticate to the container registry",
  }),
});
export type ContainerImage = z.infer<typeof ContainerImageSchema>;

export const CreateBotSchema = z.object({
  token: z.string().meta({
    description: "Discord token of the bot",
  }),
});
export type CreateBot = z.infer<typeof CreateBotSchema>;

export const BotClusterLayoutSchema = z.array(ClusterSchema).meta({
  description: "Clusters layout",
});
export type BotClusterLayout = z.infer<typeof BotClusterLayoutSchema>;

export const BotDiscordProfileSchema = z.object({
  name: z.string().meta({
    description: "Discord username of the bot",
  }),
  displayName: z.string().nullable().meta({
    description: "Discord display name (global name) of the bot, or null if none is set",
  }),
  discriminator: z.string().meta({
    description: "Discord discriminator",
  }),
  avatarUrl: z.string().nullable().meta({
    description: "URL of the bot avatar on the Discord CDN, or null if none is set",
  }),
  bannerUrl: z.string().nullable().meta({
    description: "URL of the bot banner on the Discord CDN, or null if none is set",
  }),
  accentColor: z.number().int().nullable().meta({
    description: "The bot profile accent color as an integer (0xRRGGBB)",
  }),
});
export type BotDiscordProfile = z.infer<typeof BotDiscordProfileSchema>;

export const BotSchema = z.object({
  id: z.string().meta({
    description: "Bot's ID",
  }),
  shards: z.number().nonnegative().meta({
    description: "Number of shards",
  }),
  // layout: z.array(BotClusterLayoutSchema).meta({
  //   description: "Clusters layout",
  // }),
  // containerImage: ContainerImageSchema.omit({ password: true }).meta({
  //   description: "Container image configuration associated to the bot",
  // }),
  // discordProfile: BotDiscordProfileSchema.nullable().optional().meta({
  //   description: "Bot Discord profile",
  // }),
});
export type Bot = z.infer<typeof BotSchema>;

// export const UpdateBotSchema = CreateBotSchema.extend({
//   layout: BotClusterLayoutSchema.meta({ description: "Cluster layout" }),
// });
// export type UpdateBot = z.infer<typeof UpdateBotSchema>;
