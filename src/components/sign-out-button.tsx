"use client";

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/" })}
      className="button outline dark app-inline-button"
    >
      <LogOut size={16} />
      Выйти
    </button>
  );
}
