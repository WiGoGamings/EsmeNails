import { z } from "zod";

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2, "Nombre invalido").max(120),
  email: z.string().trim().email("Email invalido"),
  birthDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha de nacimiento invalida")
    .or(z.literal("")),
  phone: z.string().trim().max(30).or(z.literal("")),
  description: z.string().trim().max(500).or(z.literal("")),
  profileImageUrl: z
    .string()
    .trim()
    .refine(
      (value) =>
        value === "" ||
        /^data:image\//.test(value) ||
        (() => {
          try {
            // Accept absolute URLs for hosted profile images.
            new URL(value);
            return true;
          } catch {
            return false;
          }
        })(),
      "URL de foto invalida"
    )
});

export const confirmEmailCodeSchema = z.object({
  code: z
    .string({ required_error: "El codigo es obligatorio" })
    .trim()
    .regex(/^\d{6}$/, "Codigo invalido")
});
