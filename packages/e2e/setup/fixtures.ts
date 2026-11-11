// The bot id is read back by the backend from the first segment of the token.
export const BOT_ID = "424242424242424242";
export const BOT_TOKEN = `${Buffer.from(BOT_ID).toString("base64")}.e2e.token`;

export const BOT_PROFILE = {
  id: BOT_ID,
  username: "hallmaster-e2e",
  global_name: "HallMaster E2E",
  discriminator: "0",
  avatar: null,
  banner: null,
  accent_color: null,
};

export const RECOMMENDED_SHARDS = 2;

export const CONTAINER_IMAGE = "nginx:alpine";

export const USER = { username: "admin", password: "password123" };
