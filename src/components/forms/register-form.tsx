"use client";

import Link from "next/link";
import { useActionState } from "react";

import { ActionMessage } from "@/components/action-message";
import { SubmitButton } from "@/components/submit-button";
import { registerUserAction } from "@/features/auth/actions";
import { initialActionState } from "@/lib/form-state";

export function RegisterForm() {
  const [state, formAction] = useActionState(
    registerUserAction,
    initialActionState,
  );

  return (
    <form action={formAction} className="card app-form">
      <div>
        <h1>Регистрация</h1>
        <p className="app-muted">
          Первый зарегистрированный пользователь автоматически станет администратором.
        </p>
      </div>

      <ActionMessage message={state.message} />

      <label className="app-field">
        <span className="app-field-title">Имя</span>
        <input
          type="text"
          name="name"
          placeholder="Ваше имя"
          required
        />
      </label>

      <label className="app-field">
        <span className="app-field-title">Email</span>
        <input
          type="email"
          name="email"
          placeholder="you@example.com"
          required
        />
      </label>

      <label className="app-field">
        <span className="app-field-title">Пароль</span>
        <input
          type="password"
          name="password"
          placeholder="Минимум 6 символов"
          required
        />
      </label>

      <SubmitButton pendingLabel="Создаем аккаунт..." block>
        Создать аккаунт
      </SubmitButton>

      <p className="app-muted">
        Уже есть аккаунт?{" "}
        <Link href="/login">
          Войти
        </Link>
      </p>
    </form>
  );
}
