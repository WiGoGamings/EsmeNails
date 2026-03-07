import { z } from "zod";

export const registerSchema = z.object({
  name: z
    .string({ required_error: "El nombre es obligatorio" })
    .trim()
    .min(2, "El nombre debe tener al menos 2 caracteres"),
  email: z
    .string({ required_error: "El email es obligatorio" })
    .trim()
    .email("El email no es valido"),
  password: z
    .string({ required_error: "La contrasena es obligatoria" })
    .min(6, "La contrasena debe tener al menos 6 caracteres")
    .regex(/^(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{6,128}$/, {
      message: "La contrasena debe incluir una mayuscula y un caracter especial"
    })
    .max(128, "La contrasena es demasiado larga")
});

export const loginSchema = z.object({
  email: z
    .string({ required_error: "El email es obligatorio" })
    .trim()
    .email("El email no es valido"),
  password: z
    .string({ required_error: "La contrasena es obligatoria" })
    .min(6, "Contrasena invalida")
});
