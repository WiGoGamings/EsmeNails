import { z } from "zod";

const orderItemSchema = z.object({
  kind: z.enum(["service", "product"]),
  id: z.string().min(1),
  quantity: z.number().int().positive()
});

export const createOrderSchema = z.object({
  items: z.array(orderItemSchema).min(1, "Debes agregar al menos un item"),
  promotionId: z.string().min(1).optional(),
  paymentMethod: z.enum(["cash", "card", "transfer"], {
    errorMap: () => ({ message: "Metodo de pago invalido" })
  }),
  donationAmount: z.number().min(0).max(500).default(0)
});
