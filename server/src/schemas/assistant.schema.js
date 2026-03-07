import { z } from "zod";

const historyItemSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(2000)
});

export const assistantContextSchema = z.object({
  services: z.array(z.object({ name: z.string().optional(), price: z.number().optional() })).max(40).optional().default([]),
  products: z.array(z.object({ name: z.string().optional(), price: z.number().optional() })).max(40).optional().default([]),
  promotions: z.array(z.object({ title: z.string().optional(), value: z.number().optional(), discountType: z.string().optional() })).max(40).optional().default([]),
  ownerContact: z.object({
    whatsapp: z.string().optional(),
    phone: z.string().optional(),
    address: z.string().optional(),
    instagram: z.string().optional()
  }).optional().default({})
}).optional();

export const assistantRequestSchema = z.object({
  message: z.string().trim().min(2, "Escribe una pregunta mas especifica").max(1200),
  history: z.array(historyItemSchema).max(12).optional().default([]),
  context: assistantContextSchema
});
