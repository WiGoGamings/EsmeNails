import { z } from "zod";

export const adminLoginSchema = z.object({
  email: z
    .string({ required_error: "El email admin es obligatorio" })
    .trim()
    .email("Email admin invalido"),
  password: z
    .string({ required_error: "La contrasena admin es obligatoria" })
    .min(6, "Contrasena admin invalida")
});

export const periodSchema = z.enum(["day", "week", "month", "year"]);

export const adminServiceSchema = z.object({
  name: z.string().trim().min(2, "Nombre de servicio invalido"),
  description: z.string().trim().max(500).optional().default(""),
  style: z.string().trim().min(2, "Estilo invalido"),
  model: z.string().trim().min(2, "Modelo invalido"),
  timeMinutes: z.number().int().min(15).max(360),
  price: z.number().min(0).max(10000),
  imageUrl: z.string().trim().max(200000).optional().default("")
});

export const adminProductSchema = z.object({
  name: z.string().trim().min(2, "Nombre de producto invalido"),
  description: z.string().trim().max(500).optional().default(""),
  price: z.number().min(0).max(10000),
  stock: z.number().int().min(0).max(100000),
  imageUrl: z.string().trim().max(200000).optional().default("")
});

export const adminPromotionSchema = z.object({
  title: z.string().trim().min(2, "Titulo de promocion invalido"),
  description: z.string().trim().max(500).optional().default(""),
  discountType: z.enum(["percentage", "fixed"]),
  value: z.number().min(0).max(10000),
  active: z.boolean(),
  imageUrl: z.string().trim().max(200000).optional().default("")
});

export const adminEmployeeSchema = z.object({
  name: z.string().trim().min(2, "Nombre de empleada invalido"),
  role: z.string().trim().min(2, "Rol invalido").default("Nail Artist"),
  active: z.boolean().default(true),
  imageUrl: z.string().trim().max(200000).optional().default("")
});

export const adminAppointmentUpdateSchema = z
  .object({
    employeeId: z.string().min(1).optional(),
    scheduledAt: z.string().datetime().optional(),
    status: z.enum(["scheduled", "confirmed", "cancelled", "completed"]).optional(),
    notes: z.string().trim().max(300).optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Debes enviar al menos un campo para actualizar"
  });

export const adminContactMessageUpdateSchema = z
  .object({
    status: z.enum(["new", "in-progress", "resolved", "closed"]).optional(),
    adminNote: z.string().trim().max(600).optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Debes enviar al menos un campo para actualizar"
  });

export const adminOwnerContactSchema = z.object({
  ownerName: z.string().trim().min(2, "Nombre del dueno invalido").max(120),
  website: z.string().trim().url("Website invalido").max(250),
  email: z.string().trim().email("Email invalido").max(160),
  phone: z.string().trim().min(6, "Telefono invalido").max(40),
  whatsapp: z.string().trim().min(6, "WhatsApp invalido").max(40),
  instagram: z.string().trim().url("Instagram invalido").max(250),
  facebook: z.string().trim().url("Facebook invalido").max(250),
  tiktok: z.string().trim().url("TikTok invalido").max(250),
  address: z.string().trim().min(5, "Direccion invalida").max(240),
  homeImageMain: z.string().trim().max(200000).optional().default(""),
  homeImageOne: z.string().trim().max(200000).optional().default(""),
  homeImageTwo: z.string().trim().max(200000).optional().default(""),
  homeImageThree: z.string().trim().max(200000).optional().default(""),
  homeImageFour: z.string().trim().max(200000).optional().default("")
});

export const adminPointsRewardSchema = z.object({
  id: z.string().trim().min(1, "ID de recompensa invalido").max(80),
  points: z.number().int().min(1).max(100000),
  title: z.string().trim().min(2, "Titulo de recompensa invalido").max(120),
  description: z.string().trim().max(400).optional().default("")
});

export const adminPointsProgramSchema = z.object({
  pointsPerAmount: z.number().min(0.01).max(100000),
  pointsPerUnit: z.number().int().min(1).max(1000),
  rewards: z.array(adminPointsRewardSchema).max(24).default([])
});
