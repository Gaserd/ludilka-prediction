"use client";

import { useActionState } from "react";

import { ActionMessage } from "@/components/action-message";
import { SubmitButton } from "@/components/submit-button";
import { createAdminAction } from "@/features/auth/actions";
import { initialActionState } from "@/lib/form-state";

export function CreateAdminForm() {
  const [state, formAction] = useActionState(
    createAdminAction,
    initialActionState,
  );

  return (
    <form action={formAction} className="card app-form">
      <div>
        <h2>Создать администратора</h2>
        <p className="app-muted">
          Новый администратор сразу получит доступ в админ-панель.
        </p>
      </div>

      <ActionMessage message={state.message} />

      <label className="app-field">
        <span className="app-field-title">Имя</span>
        <input
          type="text"
          name="name"
          required
        />
      </label>

      <label className="app-field">
        <span className="app-field-title">Email</span>
        <input
          type="email"
          name="email"
          required
        />
      </label>

      <label className="app-field">
        <span className="app-field-title">Пароль</span>
        <input
          type="password"
          name="password"
          required
        />
      </label>

      <SubmitButton pendingLabel="Создаем администратора...">
        Создать администратора
      </SubmitButton>
    </form>
  );
}
