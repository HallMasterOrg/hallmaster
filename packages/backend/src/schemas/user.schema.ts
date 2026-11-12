import z from "zod";

export const UserIdSchema = z
  .string()
  .regex(/^\d{17,20}$/, "Invalid Discord user ID")
  .meta({ description: "Discord ID of the user" });
export type UserId = z.infer<typeof UserIdSchema>;

export const UserRoleSchema = z.enum(["OWNER", "ADMIN"]).meta({
  description: "The owner manages the admins, both manage the bot",
});
export type UserRole = z.infer<typeof UserRoleSchema>;

export const UserSchema = z.object({
  id: UserIdSchema,
  username: z.string().meta({ description: "Discord username" }),
  displayName: z.string().nullable().meta({ description: "Discord display name" }),
  avatarUrl: z.string().nullable().meta({ description: "Discord avatar" }),
  role: UserRoleSchema,
  createdAt: z.iso.datetime().meta({ description: "When the user was given access" }),
});
export type User = z.infer<typeof UserSchema>;

export const UsersSchema = z.array(UserSchema).meta({
  description: "Users who can access the instance, the owner first",
});
export type Users = z.infer<typeof UsersSchema>;

export const AddUserSchema = z.object({ id: UserIdSchema });
export type AddUser = z.infer<typeof AddUserSchema>;

export const UserIdParamSchema = z.object({ id: UserIdSchema });
