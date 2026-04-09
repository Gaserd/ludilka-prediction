"use server";

import { hash } from "bcryptjs";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createAdminSchema, registerSchema } from "@/features/auth/schemas";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/env";
import { actionError, type ActionState } from "@/lib/form-state";

function parseAuthForm(formData: FormData) {
  return {
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  };
}

async function ensureUniqueEmail(email: string) {
  return db.user.findUnique({
    where: {
      email,
    },
    select: {
      id: true,
    },
  });
}

export async function registerUserAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!isDatabaseConfigured()) {
    return actionError("Сначала укажите DATABASE_URL в .env.");
  }

  const parsed = registerSchema.safeParse(parseAuthForm(formData));

  if (!parsed.success) {
    return actionError(
      "Проверьте форму регистрации.",
      parsed.error.flatten().fieldErrors,
    );
  }

  const email = parsed.data.email.toLowerCase();
  const existing = await ensureUniqueEmail(email);

  if (existing) {
    return actionError("Пользователь с таким email уже существует.");
  }

  const usersCount = await db.user.count();
  const passwordHash = await hash(parsed.data.password, 12);

  await db.user.create({
    data: {
      name: parsed.data.name,
      email,
      passwordHash,
      role: usersCount === 0 ? "ADMIN" : "USER",
    },
  });

  revalidatePath("/admin");
  redirect("/login?registered=1");
}

export async function createAdminAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!isDatabaseConfigured()) {
    return actionError("Сначала укажите DATABASE_URL в .env.");
  }

  const actor = await requireAdmin();
  const parsed = createAdminSchema.safeParse(parseAuthForm(formData));

  if (!parsed.success) {
    return actionError(
      "Проверьте форму создания администратора.",
      parsed.error.flatten().fieldErrors,
    );
  }

  const email = parsed.data.email.toLowerCase();
  const existing = await ensureUniqueEmail(email);

  if (existing) {
    return actionError("Администратор с таким email уже существует.");
  }

  const passwordHash = await hash(parsed.data.password, 12);

  const admin = await db.user.create({
    data: {
      name: parsed.data.name,
      email,
      passwordHash,
      role: "ADMIN",
    },
  });

  await db.auditLog.create({
    data: {
      actorId: actor.id,
      action: "admin.created",
      entityType: "User",
      entityId: admin.id,
      details: JSON.parse(
        JSON.stringify({
          email: admin.email,
        }),
      ),
    },
  });

  revalidatePath("/admin");
  redirect("/admin?adminCreated=1");
}
