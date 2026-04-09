import Link from "next/link";

import { ActionMessage } from "@/components/action-message";
import { CreateAdminForm } from "@/components/forms/create-admin-form";
import { EventForm } from "@/components/forms/event-form";
import { SubmitButton } from "@/components/submit-button";
import {
  changeEventStatusAction,
  createEventAction,
  resolveEventAction,
} from "@/features/events/actions";
import { getAdminDashboardData } from "@/features/events/queries";
import { requireAdmin } from "@/lib/auth";
import { isDatabaseConfigured } from "@/lib/env";
import { buildSearchParamMessage, formatDateTime, formatPercent } from "@/lib/utils";

export const dynamic = "force-dynamic";

type AdminPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function statusTone(status: string) {
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

export default async function AdminPage({ searchParams }: AdminPageProps) {
  await requireAdmin();
  const [query, data] = await Promise.all([searchParams, getAdminDashboardData()]);

  const successMessage =
    buildSearchParamMessage(query.adminCreated, {
      "1": "Новый администратор создан.",
    }) ??
    buildSearchParamMessage(query.eventCreated, {
      "1": "Событие создано.",
    }) ??
    buildSearchParamMessage(query.eventUpdated, {
      "1": "Событие обновлено.",
    }) ??
    buildSearchParamMessage(query.statusChanged, {
      "1": "Статус события изменен.",
    }) ??
    buildSearchParamMessage(query.resolved, {
      "1": "Исход события сохранен.",
    });

  const errorMessage =
    buildSearchParamMessage(query.statusError, {
      db: "Сначала настройте подключение к базе данных.",
      invalid: "Некорректный запрос на смену статуса.",
      missing: "Событие не найдено.",
      transition: "Такой переход статуса недоступен.",
    }) ??
    buildSearchParamMessage(query.resolveError, {
      db: "Сначала настройте подключение к базе данных.",
      invalid: "Проверьте форму резолва.",
      missing: "Событие не найдено.",
      outcome: "Выбранный исход не принадлежит событию.",
    });

  return (
    <div className="container app-page">
      <section className="card app-hero">
        <div className="row">
          <div className="col-12 col-8-md">
            <span className="tag app-soft-tag">Админ-панель</span>
            <h1 className="app-hero-title">
              Управление администраторами, событиями и ручным расчетом исходов.
            </h1>
            <p className="app-hero-copy">
              Здесь можно создавать новых администраторов, заводить события с коэффициентами, публиковать их, закрывать и вручную резолвить результат с привязкой к будущей автоматизации.
            </p>
          </div>

          <div className="col-12 col-4-md">
            <div className="app-stat-grid">
              <div className="card app-stat-card">
                <span className="app-muted">Администраторов</span>
                <strong>{data.admins.length}</strong>
              </div>
              <div className="card app-stat-card">
                <span className="app-muted">Всего событий</span>
                <strong>{data.events.length}</strong>
              </div>
              <div className="card app-stat-card">
                <span className="app-muted">Активных прогнозов</span>
                <strong>
                  {data.events.reduce(
                    (sum: number, event) => sum + event._count.predictions,
                    0,
                  )}
                </strong>
              </div>
            </div>
          </div>
        </div>
      </section>

      {!isDatabaseConfigured() && (
        <div className="app-section">
          <ActionMessage
            message="Для работы панели настройте PostgreSQL через DATABASE_URL и выполните Prisma-команды из README/terminal."
            tone="info"
          />
        </div>
      )}

      <div className="app-section">
        <ActionMessage message={successMessage} tone="success" />
        <ActionMessage message={errorMessage} />
      </div>

      <section className="app-section">
        <div className="row">
          <div className="col-12 col-5-lg">
            <CreateAdminForm />
          </div>

          <div className="col-12 col-7-lg">
            <div className="card">
              <h2>Активные администраторы</h2>
              <p className="app-muted">
                Все админы равноправны и могут создавать события и других администраторов.
              </p>

              {data.admins.length === 0 ? (
                <p className="app-note">Администраторы еще не созданы.</p>
              ) : (
                <div className="app-profile-list">
                  {data.admins.map((admin) => (
                    <div key={admin.id} className="app-outcome-card">
                      <div className="app-card-meta">
                        <div>
                          <strong>{admin.name}</strong>
                          <p className="app-muted">{admin.email}</p>
                        </div>
                        <span className="app-muted">
                          Создан: {formatDateTime(admin.createdAt)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="app-section">
        <EventForm action={createEventAction} submitLabel="Создать событие" />
      </section>

      <section className="app-section">
        <div className="app-section-head">
          <div>
            <h2>Каталог событий</h2>
            <p className="app-muted">
              Управляйте жизненным циклом события от черновика до резолва.
            </p>
          </div>
        </div>

        {data.events.length === 0 ? (
          <div className="card app-empty">
            Событий пока нет. Создайте первое событие через форму выше.
          </div>
        ) : (
          <div className="app-profile-list">
            {data.events.map((event) => (
              <article key={event.id} className="card">
                <div className="app-card-meta">
                  <div>
                    <h3>{event.title}</h3>
                    <span className={`tag app-status ${statusTone(event.status)}`}>
                      {event.status}
                    </span>
                  </div>

                  <div className="app-meta-list">
                    <span>Создано: {formatDateTime(event.createdAt)}</span>
                    <span>Прогнозов: {event._count.predictions}</span>
                    {event.publishedAt && (
                      <span>Опубликовано: {formatDateTime(event.publishedAt)}</span>
                    )}
                  </div>
                </div>

                <p className="app-muted">{event.description}</p>
                <p className="app-note">{event.conditionText}</p>
                <p className="app-muted">
                  Текущие вероятности пересчитываются как смесь стартовой оценки и прогнозов пользователей.
                </p>

                <div className="app-outcome-grid">
                  {event.outcomes.map((outcome) => (
                    <div key={outcome.id} className="app-outcome-card">
                      <strong>{outcome.label}</strong>
                      <div>{formatPercent(Number(outcome.probabilityPercent))}</div>
                      <div className="app-outcome-meta">
                        База: {formatPercent(Number(outcome.initialProbabilityPercent))}
                      </div>
                      <div className="app-outcome-meta">
                        Прогнозов: {outcome.predictionCount}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="app-actions">
                  {event.status === "DRAFT" && (
                    <>
                      <Link href={`/admin/events/${event.id}`} className="button outline">
                        Редактировать черновик
                      </Link>
                      <form action={changeEventStatusAction}>
                        <input type="hidden" name="eventId" value={event.id} />
                        <input type="hidden" name="status" value="PUBLISHED" />
                        <SubmitButton pendingLabel="Публикуем...">Опубликовать</SubmitButton>
                      </form>
                      <form action={changeEventStatusAction}>
                        <input type="hidden" name="eventId" value={event.id} />
                        <input type="hidden" name="status" value="CANCELLED" />
                        <SubmitButton
                          variant="error"
                          pendingLabel="Отменяем..."
                        >
                          Отменить
                        </SubmitButton>
                      </form>
                    </>
                  )}

                  {event.status === "PUBLISHED" && (
                    <>
                      <Link href={`/events/${event.slug}`} className="button outline">
                        Открыть публичную страницу
                      </Link>
                      <form action={changeEventStatusAction}>
                        <input type="hidden" name="eventId" value={event.id} />
                        <input type="hidden" name="status" value="CLOSED" />
                        <SubmitButton pendingLabel="Закрываем...">
                          Закрыть прием прогнозов
                        </SubmitButton>
                      </form>
                    </>
                  )}

                  {event.status === "CLOSED" && (
                    <form action={changeEventStatusAction}>
                      <input type="hidden" name="eventId" value={event.id} />
                      <input type="hidden" name="status" value="CANCELLED" />
                      <SubmitButton variant="error" pendingLabel="Отменяем...">
                        Отменить событие
                      </SubmitButton>
                    </form>
                  )}
                </div>

                {event.status === "CLOSED" && (
                  <form action={resolveEventAction} className="app-resolution-form">
                    <input type="hidden" name="eventId" value={event.id} />

                    <label className="app-field">
                      <span className="app-field-title">Победивший исход</span>
                      <select name="winningOutcomeId" required>
                        <option value="">Выберите исход</option>
                        {event.outcomes.map((outcome) => (
                          <option key={outcome.id} value={outcome.id}>
                            {outcome.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="app-field">
                      <span className="app-field-title">Подтверждение</span>
                      <input
                        type="url"
                        name="proofUrl"
                        placeholder="https://..."
                      />
                    </label>

                    <label className="app-field">
                      <span className="app-field-title">Комментарий</span>
                      <input
                        type="text"
                        name="notes"
                        placeholder="Короткое пояснение"
                      />
                    </label>

                    <div className="app-center-column">
                      <SubmitButton pendingLabel="Фиксируем исход...">
                        Зафиксировать исход
                      </SubmitButton>
                    </div>
                  </form>
                )}

                {event.resolution && (
                  <div className="app-alert app-alert-success">
                    Исход уже зафиксирован:{" "}
                    <strong>{event.resolution.winningOutcome.label}</strong>. Резолв выполнен{" "}
                    {formatDateTime(event.resolution.resolvedAt)}.
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
