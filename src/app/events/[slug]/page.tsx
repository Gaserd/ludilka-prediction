import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MessageCircle } from "lucide-react";

import { ActionMessage } from "@/components/action-message";
import { SubmitButton } from "@/components/submit-button";
import {
  addPredictionCommentAction,
  submitPredictionAction,
} from "@/features/predictions/actions";
import { getPublicEventBySlug } from "@/features/events/queries";
import { auth } from "@/lib/auth";
import { buildSearchParamMessage, formatDateTime, formatPercent } from "@/lib/utils";

export const dynamic = "force-dynamic";

const CHART_COLORS = ["#3467eb", "#2f9e67", "#cf4b4b", "#9b59b6", "#f59e0b"];

function MarketHistoryChart({
  history,
}: {
  history: Array<{
    at: Date;
    outcomes: Array<{
      id: string;
      label: string;
      probabilityPercent: number;
    }>;
  }>;
}) {
  if (history.length === 0) {
    return null;
  }

  const width = 960;
  const height = 300;
  const padding = { top: 20, right: 22, bottom: 36, left: 34 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const timestamps = history.map((point) => new Date(point.at).getTime());
  const minTimestamp = Math.min(...timestamps);
  const maxTimestamp = Math.max(...timestamps);

  const getX = (timestamp: number, index: number) => {
    if (history.length === 1 || maxTimestamp === minTimestamp) {
      return padding.left + (chartWidth * index) / Math.max(history.length - 1, 1);
    }

    return (
      padding.left +
      ((timestamp - minTimestamp) / (maxTimestamp - minTimestamp)) * chartWidth
    );
  };

  const getY = (value: number) =>
    padding.top + ((100 - value) / 100) * chartHeight;

  const gridValues = [0, 25, 50, 75, 100];
  const startLabel = formatDateTime(history[0].at);
  const endLabel = formatDateTime(history[history.length - 1].at);

  return (
    <div className="card app-market-chart-card">
      <div className="app-section-head">
        <div>
          <h2>Динамика вероятностей</h2>
          <p className="app-muted">
            Линии меняются каждый раз, когда кто-то отправляет новый прогноз.
          </p>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="app-market-chart"
        role="img"
        aria-label="История изменения вероятностей исходов события"
      >
        {gridValues.map((value) => {
          const y = getY(value);

          return (
            <g key={value}>
              <line
                x1={padding.left}
                x2={width - padding.right}
                y1={y}
                y2={y}
                className="app-market-grid-line"
              />
              <text
                x={padding.left - 8}
                y={y + 4}
                textAnchor="end"
                className="app-market-axis-label"
              >
                {value}%
              </text>
            </g>
          );
        })}

        {history[0].outcomes.map((outcome, outcomeIndex) => {
          const color = CHART_COLORS[outcomeIndex % CHART_COLORS.length];
          const points = history.map((snapshot, snapshotIndex) => {
            const snapshotOutcome =
              snapshot.outcomes.find((item) => item.id === outcome.id) ?? outcome;
            return {
              x: getX(new Date(snapshot.at).getTime(), snapshotIndex),
              y: getY(snapshotOutcome.probabilityPercent),
              value: snapshotOutcome.probabilityPercent,
            };
          });

          const linePath = points
            .map((point, index) =>
              `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`,
            )
            .join(" ");

          const latestPoint = points[points.length - 1];

          return (
            <g key={outcome.id}>
              <path
                d={linePath}
                fill="none"
                stroke={color}
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {points.map((point, pointIndex) => (
                <circle
                  key={`${outcome.id}-${pointIndex}`}
                  cx={point.x}
                  cy={point.y}
                  r={pointIndex === points.length - 1 ? 4 : 2.5}
                  fill={color}
                />
              ))}
              <text
                x={latestPoint.x + 8}
                y={latestPoint.y + 4}
                fill={color}
                className="app-market-last-value"
              >
                {formatPercent(latestPoint.value)}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="app-market-legend">
        {history[0].outcomes.map((outcome, outcomeIndex) => (
          <div key={outcome.id} className="app-market-legend-item">
            <span
              className="app-market-legend-dot"
              style={{ backgroundColor: CHART_COLORS[outcomeIndex % CHART_COLORS.length] }}
            />
            <span>{outcome.label}</span>
          </div>
        ))}
      </div>

      <div className="app-market-axis-range">
        <span>{startLabel}</span>
        <span>{endLabel}</span>
      </div>
    </div>
  );
}

type EventPageProps = {
  params: Promise<{
    slug: string;
  }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function EventPage({
  params,
  searchParams,
}: EventPageProps) {
  const [{ slug }, query, session] = await Promise.all([params, searchParams, auth()]);
  const event = await getPublicEventBySlug(slug);

  if (!event) {
    notFound();
  }

  const successMessage = buildSearchParamMessage(query.predicted, {
    "1": "Ваш прогноз сохранен.",
  }) ??
    buildSearchParamMessage(query.commented, {
      "1": "Комментарий добавлен.",
    });

  const errorMessage = buildSearchParamMessage(query.error, {
    db: "Сначала настройте подключение к базе данных.",
    invalid: "Проверьте выбранный исход.",
    closed: "Прием прогнозов по этому событию уже закрыт.",
    outcome: "Выбранный исход не найден.",
    exists: "Вы уже отправили прогноз по этому событию. Повторная ставка недоступна.",
    comment: "Не удалось добавить комментарий. Проверьте текст комментария.",
    commentMissing: "Прогноз для комментария не найден.",
    commentClosed: "Комментирование этого прогноза недоступно.",
  });

  const ownPrediction = session?.user
    ? event.predictions.find((prediction) => prediction.userId === session.user.id)
    : null;
  const canPredict = event.status === "PUBLISHED" && session?.user && !ownPrediction;
  const statusClass =
    event.status === "PUBLISHED"
      ? "app-status-published"
      : event.status === "CLOSED"
        ? "app-status-closed"
        : "app-status-resolved";

  return (
    <div className="container app-page">
      <div className="row">
        <div className="col-12 col-8-lg">
          <div className="card">
            {event.imagePath ? (
              <Image
                src={event.imagePath}
                alt={event.title}
                width={1600}
                height={800}
                className="app-image"
              />
            ) : (
              <div className="app-image-placeholder">
                Изображение не загружено
              </div>
            )}

            <div>
              <div className="app-card-meta app-card-meta-spaced">
                <span className={`tag app-status ${statusClass}`}>
                  {event.status === "PUBLISHED"
                    ? "Открыто"
                    : event.status === "CLOSED"
                      ? "Закрыто"
                      : "Рассчитано"}
                </span>
                <span className="app-muted">Создано: {formatDateTime(event.createdAt)}</span>
                {event.closesAt && (
                  <span className="app-muted">Закрытие: {formatDateTime(event.closesAt)}</span>
                )}
              </div>

              <h1>{event.title}</h1>
              <p className="app-muted">{event.description}</p>

              <section className="app-form-section">
                <h3>Условие выполнения</h3>
                <p className="app-note">{event.conditionText}</p>
                {(event.sourceType || event.sourceUrl || event.externalEntityId) && (
                  <div className="app-detail-list">
                    {event.sourceType && <p>Источник: {event.sourceType}</p>}
                    {event.externalEntityId && (
                      <p>Внешний идентификатор: {event.externalEntityId}</p>
                    )}
                    {event.sourceUrl && (
                      <Link href={event.sourceUrl} target="_blank" className="button outline">
                        Открыть источник
                      </Link>
                    )}
                  </div>
                )}
              </section>
            </div>
          </div>

          <section className="card app-section">
            <div className="app-section-head">
              <div>
                <h2>Рынок события</h2>
                <p className="app-muted">
                  Текущие вероятности пересчитываются из стартовых значений и новых прогнозов.
                </p>
              </div>
              <span className="tag app-status app-status-draft">
                Всего: {event.predictions.length}
              </span>
            </div>

            <div className="app-market-summary">
              {event.outcomes.map((outcome) => (
                <div key={outcome.id} className="app-outcome-card">
                  <div className="app-outcome-head">
                    <strong>{outcome.label}</strong>
                    <span>{formatPercent(Number(outcome.probabilityPercent))}</span>
                  </div>

                  <div className="app-outcome-meta">
                    Старт: {formatPercent(Number(outcome.initialProbabilityPercent))}
                  </div>
                  <div className="app-outcome-meta">
                    Выбрали: {outcome.predictionCount}
                  </div>
                  {event.resolution?.winningOutcomeId === outcome.id && (
                    <div className="app-outcome-meta app-note-success">
                      Победивший исход
                    </div>
                  )}
                </div>
              ))}
            </div>

            <MarketHistoryChart history={event.marketHistory} />
          </section>

          <section className="card app-section">
            <div className="app-section-head">
              <div>
                <h2>Прогнозы участников</h2>
                <p className="app-muted">
                  Список отсортирован от самых комментируемых прогнозов к самым тихим.
                </p>
              </div>
            </div>

            <ActionMessage message={successMessage} tone="success" />
            <ActionMessage message={errorMessage} />

            {event.predictions.length === 0 ? (
              <div className="app-empty">
                Пока нет прогнозов участников.
              </div>
            ) : (
              <div className="app-prediction-list">
                {event.predictions.map((prediction) => {
                  const isWinningPrediction =
                    event.resolution?.winningOutcomeId === prediction.outcomeId;
                  const isOwnPrediction = prediction.userId === session?.user?.id;

                  return (
                    <article
                      key={prediction.id}
                      className="app-prediction-item"
                      id={`prediction-${prediction.id}`}
                    >
                      <div className="app-card-meta">
                        <div>
                          <div className="app-prediction-headline">
                            <strong>{prediction.user.name}</strong>
                            {isOwnPrediction && (
                              <span className="tag app-status app-status-resolved">
                                Ваш прогноз
                              </span>
                            )}
                          </div>
                          <p className="app-muted">
                            Сделан: {formatDateTime(prediction.createdAt)}
                          </p>
                        </div>

                        <div className="app-prediction-choice">
                          <span className="tag app-status app-status-published">
                            {prediction.outcome.label}
                          </span>
                          <span className="tag app-status app-status-draft">
                            На входе: {formatPercent(prediction.lockedProbabilityPercent)}
                          </span>
                          <span className="tag app-status app-status-draft">
                            Комментариев: {prediction.commentCount}
                          </span>
                          {isWinningPrediction && (
                            <span className="tag app-status app-status-resolved">
                              Верный исход
                            </span>
                          )}
                        </div>
                      </div>

                      {prediction.note && (
                        <div className="app-prediction-note">
                          <div className="app-note-label">Комментарий автора прогноза</div>
                          <p className="app-note">{prediction.note}</p>
                        </div>
                      )}

                      <div className="app-comment-section">
                        <div className="app-comment-header">
                          <h4>Комментарии</h4>
                          {session?.user && (
                            <details className="app-comment-compose">
                              <summary
                                className="button outline app-comment-toggle"
                                aria-label="Добавить комментарий"
                              >
                                <MessageCircle size={15} />
                              </summary>

                              <form
                                action={addPredictionCommentAction}
                                className="app-comment-form app-comment-panel"
                              >
                                <input
                                  type="hidden"
                                  name="predictionId"
                                  value={prediction.id}
                                />
                                <input type="hidden" name="slug" value={event.slug} />

                                <label className="app-field">
                                  <span className="app-field-title">
                                    Добавить комментарий
                                  </span>
                                  <textarea
                                    name="body"
                                    rows={2}
                                    maxLength={500}
                                    placeholder="Напишите, что думаете про этот прогноз"
                                    required
                                  />
                                </label>

                                <div className="app-comment-actions">
                                  <SubmitButton
                                    pendingLabel="Публикуем..."
                                    variant="primary"
                                  >
                                    Отправить
                                  </SubmitButton>
                                </div>
                              </form>
                            </details>
                          )}
                        </div>

                        {prediction.comments.length === 0 ? (
                          <p className="app-muted">Пока без комментариев.</p>
                        ) : (
                          <div className="app-comment-list">
                            {prediction.comments.map((comment) => (
                              <div key={comment.id} className="app-comment-item">
                                <div className="app-card-meta">
                                  <strong>{comment.author.name}</strong>
                                  <span className="app-muted">
                                    {formatDateTime(comment.createdAt)}
                                  </span>
                                </div>
                                <p className="app-note">{comment.body}</p>
                              </div>
                            ))}
                          </div>
                        )}

                        {!session?.user && (
                          <p className="app-muted">
                            <Link href={`/login?callbackUrl=/events/${event.slug}`}>
                              Войдите
                            </Link>{" "}
                            чтобы комментировать прогнозы.
                          </p>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        <aside className="col-12 col-4-lg app-sidebar-stack">
          <div className="card">
            <h2>Сделать прогноз</h2>
            <p className="app-muted">
              Пользователь может отправить только один прогноз на это событие.
            </p>

            {canPredict ? (
              <form action={submitPredictionAction} className="app-form">
                <input type="hidden" name="eventId" value={event.id} />
                <input type="hidden" name="slug" value={event.slug} />

                <fieldset className="app-form">
                  <legend className="app-field-title">Выберите исход</legend>
                  {event.outcomes.map((outcome) => (
                    <label key={outcome.id} className="app-radio-option">
                      <input
                        type="radio"
                        name="outcomeId"
                        value={outcome.id}
                        required
                      />
                      <span>
                        <span>{outcome.label}</span>
                        <span className="app-muted">
                          {formatPercent(Number(outcome.probabilityPercent))}
                        </span>
                      </span>
                    </label>
                  ))}
                </fieldset>

                <label className="app-field">
                  <span className="app-field-title">Комментарий к прогнозу</span>
                  <textarea
                    name="note"
                    rows={4}
                    maxLength={280}
                    placeholder="Почему вы считаете, что этот исход сработает?"
                  />
                </label>

                <SubmitButton pendingLabel="Сохраняем прогноз..." block>
                  Сохранить прогноз
                </SubmitButton>
              </form>
            ) : session?.user ? ownPrediction ? (
              <p className="app-note">
                Вы уже сделали прогноз на это событие. Теперь его можно обсуждать в общей ленте прогнозов.
              </p>
            ) : (
              <p className="app-note">
                Прогнозирование доступно только для событий со статусом `PUBLISHED`.
              </p>
            ) : (
              <div className="app-note">
                Чтобы сделать прогноз,{" "}
                <Link href={`/login?callbackUrl=/events/${event.slug}`}>
                  войдите в аккаунт
                </Link>
                .
              </div>
            )}

            {event.resolution && (
              <div className="app-alert app-alert-success">
                Событие рассчитано {formatDateTime(event.resolution.resolvedAt)}.
                {event.resolution.notes && ` ${event.resolution.notes}`}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
