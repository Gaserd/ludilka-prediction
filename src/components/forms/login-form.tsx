"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { ActionMessage } from "@/components/action-message";
import { loginSchema } from "@/features/auth/schemas";

type LoginValues = z.infer<typeof loginSchema>;

type LoginFormProps = {
  callbackUrl?: string;
};

export function LoginForm({ callbackUrl = "/" }: LoginFormProps) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);

    const result = await signIn("credentials", {
      email: values.email,
      password: values.password,
      redirect: false,
      callbackUrl,
    });

    if (!result || result.error) {
      setFormError("Неверный email или пароль.");
      return;
    }

    router.push(result.url ?? callbackUrl);
    router.refresh();
  });

  return (
    <form onSubmit={onSubmit} className="card app-form">
      <div>
        <h1>Вход</h1>
        <p className="app-muted">
          Войдите, чтобы делать прогнозы и управлять событиями.
        </p>
      </div>

      <ActionMessage message={formError} />

      <label className="app-field">
        <span className="app-field-title">Email</span>
        <input
          type="email"
          {...register("email")}
          placeholder="admin@example.com"
        />
        <ActionMessage message={errors.email?.message} />
      </label>

      <label className="app-field">
        <span className="app-field-title">Пароль</span>
        <input
          type="password"
          {...register("password")}
          placeholder="Минимум 6 символов"
        />
        <ActionMessage message={errors.password?.message} />
      </label>

      <button
        type="submit"
        disabled={isSubmitting}
        className="button primary app-full-width"
      >
        {isSubmitting ? "Проверяем..." : "Войти"}
      </button>

      <p className="app-muted">
        Нет аккаунта?{" "}
        <Link href="/register">
          Зарегистрироваться
        </Link>
      </p>
    </form>
  );
}
