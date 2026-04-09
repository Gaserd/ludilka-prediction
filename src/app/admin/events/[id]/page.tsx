import Link from "next/link";
import { notFound } from "next/navigation";

import { EventForm } from "@/components/forms/event-form";
import { updateDraftEventAction } from "@/features/events/actions";
import { getEditableEventById } from "@/features/events/queries";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

type AdminEventPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function AdminEventPage({ params }: AdminEventPageProps) {
  await requireAdmin();
  const { id } = await params;
  const event = await getEditableEventById(id);

  if (!event) {
    notFound();
  }

  return (
    <div className="container app-page">
      <div className="app-section">
        <Link href="/admin" className="app-back-link">
          Назад в админ-панель
        </Link>
        <h1>{event.status === "DRAFT" ? "Редактирование черновика" : "Карточка события"}</h1>
        <p className="app-muted">
          Полное изменение исходов доступно только для черновиков без прогнозов.
        </p>
      </div>

      {event.status === "DRAFT" ? (
        <EventForm
          action={updateDraftEventAction}
          submitLabel="Сохранить изменения"
          initialEvent={event}
        />
      ) : (
        <div className="card app-empty">
          Это событие уже вышло из стадии черновика. Для дальнейшего управления используйте каталог событий в админ-панели.
        </div>
      )}
    </div>
  );
}
