import Link from "next/link";

import { requireUser } from "@/lib/auth";
import { formatDateTime } from "@/lib/utils";
import { getUserPredictions } from "@/features/events/queries";

export const dynamic = "force-dynamic";

function statusClass(status: string) {
  switch (status) {
    case "PUBLISHED":
      return "app-status-published";
    case "CLOSED":
      return "app-status-closed";
    case "RESOLVED":
      return "app-status-resolved";
    case "CANCELLED":
      return "app-status-cancelled";
    default:
      return "app-status-draft";
  }
}

export default async function ProfilePage() {
  const user = await requireUser();
  const predictions = await getUserPredictions(user.id);

  return (
    <div className="container app-page">
      <section className="card app-hero">
        <span className="tag app-soft-tag">Профиль пользователя</span>
        <h1 className="app-hero-title">{user.name}</h1>
        <p className="app-hero-copy">Здесь собрана история всех ваших прогнозов по событиям.</p>
      </section>

      <section className="app-section">
        <div>
          <h2>История прогнозов</h2>
          <p className="app-muted">
            Здесь хранятся отправленные вами прогнозы по событиям.
          </p>
        </div>

        {predictions.length === 0 ? (
          <div className="card app-empty">
            У вас пока нет прогнозов.{" "}
            <Link href="/" className="button outline">
              Перейти к событиям
            </Link>
          </div>
        ) : (
          <div className="app-profile-list">
            {predictions.map((prediction) => {
              const winningOutcome = prediction.event.resolution?.winningOutcome?.label;
              const isResolved = prediction.event.status === "RESOLVED";
              const isWinner = winningOutcome === prediction.outcome.label;

              return (
                <article key={prediction.id} className="card">
                  <div className="app-card-meta">
                    <div>
                      <Link href={`/events/${prediction.event.slug}`}>
                        {prediction.event.title}
                      </Link>
                      <p className="app-muted">
                        Выбранный исход:{" "}
                        <strong>{prediction.outcome.label}</strong>
                      </p>
                      <p className="app-muted">
                        Прогноз обновлен: {formatDateTime(prediction.updatedAt)}
                      </p>
                    </div>

                    <span className={`tag app-status ${statusClass(prediction.event.status)}`}>
                      {prediction.event.status}
                    </span>
                  </div>

                  {prediction.note && (
                    <p className="app-note">{prediction.note}</p>
                  )}

                  {isResolved && (
                    <div className="app-form-section">
                      <p>
                        Победивший исход:{" "}
                        <strong>{winningOutcome}</strong>
                      </p>
                      <p className={isWinner ? "app-note-success" : "app-note-error"}>
                        {isWinner ? "Ваш прогноз оказался верным." : "Ваш прогноз не сработал."}
                      </p>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
