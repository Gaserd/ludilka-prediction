import { redirect } from "next/navigation";

import { ActionMessage } from "@/components/action-message";
import { LoginForm } from "@/components/forms/login-form";
import { auth } from "@/lib/auth";
import { buildSearchParamMessage } from "@/lib/utils";

type LoginPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const [session, query] = await Promise.all([auth(), searchParams]);

  if (session?.user) {
    redirect(session.user.role === "ADMIN" ? "/admin" : "/profile");
  }

  const infoMessage = buildSearchParamMessage(query.registered, {
    "1": "Аккаунт создан. Теперь войдите в систему.",
  });

  const callbackUrl =
    typeof query.callbackUrl === "string" ? query.callbackUrl : "/";

  return (
    <div className="container app-page">
      <div className="app-auth-layout">
        <section className="card app-hero">
          <span className="tag app-soft-tag">Авторизация</span>
          <h1 className="app-hero-title">
            Войдите, чтобы делать прогнозы и управлять событиями.
          </h1>
          <p className="app-hero-copy">
          После входа пользователь получает доступ к истории своих прогнозов, а администратор дополнительно видит админ-панель и инструменты управления событиями.
          </p>
          <ActionMessage message={infoMessage} tone="success" />
        </section>

        <LoginForm callbackUrl={callbackUrl} />
      </div>
    </div>
  );
}
