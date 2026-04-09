import Link from "next/link";

import { auth } from "@/lib/auth";
import { SignOutButton } from "@/components/sign-out-button";

export async function SiteHeader() {
  const session = await auth();
  const user = session?.user;

  return (
    <header className="app-header">
      <div className="container">
        <nav className="nav app-nav">
          <div className="nav-left">
            <div className="tabs app-tabs">
              <Link href="/">События</Link>
              <Link href="/leaderboard">Лидерборд</Link>
              {user && <Link href="/profile">Мои прогнозы</Link>}
              {user?.role === "ADMIN" && <Link href="/admin">Админ-панель</Link>}
            </div>
          </div>

          <div className="nav-right app-user-block">
          {user ? (
            <>
              <div className="app-user-meta">
                <p className="app-user-name">{user.name}</p>
              </div>
              <SignOutButton />
            </>
          ) : (
            <>
              <Link href="/login" className="button outline">
                Войти
              </Link>
              <Link href="/register" className="button primary">
                Регистрация
              </Link>
            </>
          )}
          </div>
        </nav>
      </div>
    </header>
  );
}
