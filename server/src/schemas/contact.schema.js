import { z } from "zod";

export const createContactMessageSchema = z.object({
  subject: z.string().trim().min(3, "Asunto invalido").max(140),
  message: z.string().trim().min(10, "Mensaje demasiado corto").max(1200),
  preferredContact: z.enum(["email", "phone"]).default("email")
});
