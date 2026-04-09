import { redirect } from "next/navigation";

import { RegisterForm } from "@/components/forms/register-form";
import { auth } from "@/lib/auth";

export default async function RegisterPage() {
  const session = await auth();

  if (session?.user) {
    redirect(session.user.role === "ADMIN" ? "/admin" : "/profile");
  }

  return (
    <div className="container app-page">
      <div className="app-auth-layout">
        <section className="card app-hero">
          <span className="tag app-soft-tag">Регистрация</span>
          <h1 className="app-hero-title">
            Создайте аккаунт, чтобы делать прогнозы по событиям.
          </h1>
          <p className="app-hero-copy">
          В MVP первый зарегистрированный пользователь получает роль администратора и может сразу создавать события, админов и исходы.
          </p>
        </section>

        <RegisterForm />
      </div>
    </div>
  );
}
