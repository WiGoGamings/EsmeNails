import { z } from "zod";

export const createAppointmentSchema = z.object({
  serviceId: z.string().min(1),
  employeeId: z.string().min(1),
  scheduledAt: z.string().datetime(),
  notes: z.string().trim().max(300).optional()
});
