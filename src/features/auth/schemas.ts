import { z } from "zod";

export const loginSchema = z.object({
  email: z.email("Введите корректный email."),
  password: z.string().min(6, "Пароль должен содержать минимум 6 символов."),
});

export const registerSchema = loginSchema.extend({
  name: z.string().trim().min(2, "Введите имя длиной не менее 2 символов."),
});

export const createAdminSchema = registerSchema;
