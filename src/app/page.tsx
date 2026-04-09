import Image from "next/image";
import Link from "next/link";

import { isDatabaseConfigured } from "@/lib/env";
import { formatDateTime, formatPercent } from "@/lib/utils";
import { getPublicEvents } from "@/features/events/queries";

export const dynamic = "force-dynamic";

function ProbabilityTrend({
  initial,
  current,
}: {
  initial: number;
  current: number;
}) {
  const width = 108;
  const height = 28;
  const padding = 4;
  const scaleY = (value: number) =>
    height - padding - ((Math.max(0, Math.min(100, value)) / 100) * (height - padding * 2));

  const startY = scaleY(initial);
  const endY = scaleY(current);
  const trendUp = current > initial;
  const trendDown = current < initial;
  const lineColor = trendUp ? "#2f9e67" : trendDown ? "#cf4b4b" : "#7b8798";
  const areaColor = trendUp ? "rgba(47, 158, 103, 0.12)" : trendDown ? "rgba(207, 75, 75, 0.12)" : "rgba(123, 135, 152, 0.12)";
  const points = `4,${startY} ${width - 4},${endY}`;
  const areaPath = `M 4 ${height - padding} L 4 ${startY} L ${width - 4} ${endY} L ${width - 4} ${height - padding} Z`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="app-outcome-trend"
      aria-label={`Тренд вероятности от ${formatPercent(initial)} к ${formatPercent(current)}`}
      role="img"
    >
      <line
        x1="4"
        y1={height - padding}
        x2={width - 4}
        y2={height - padding}
        className="app-outcome-trend-base"
      />
      <path d={areaPath} fill={areaColor} />
      <polyline
        fill="none"
        stroke={lineColor}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
      <circle cx="4" cy={startY} r="2.5" fill={lineColor} />
      <circle cx={width - 4} cy={endY} r="3" fill={lineColor} />
    </svg>
  );
}

function statusLabel(status: string) {
  switch (status) {
    case "PUBLISHED":
      return "Открыто для прогнозов";
    case "CLOSED":
      return "Прием прогнозов закрыт";
    case "RESOLVED":
      return "Событие завершено";
    default:
      return status;
  }
}

function statusClass(status: string) {
  switch (status) {
    case "PUBLISHED":
      return "app-status-published";
    case "CLOSED":
      return "app-status-closed";
    case "RESOLVED":
      return "app-status-resolved";
    default:
      return "app-status-draft";
  }
}

export default async function HomePage() {
  const events = await getPublicEvents();

  return (
    <div className="container app-page">
      {!isDatabaseConfigured() && (
        <div className="app-section">
          <div className="app-alert app-alert-info">
            Для полноценной работы подключите PostgreSQL через `DATABASE_URL` и выполните
            ` npm run prisma:generate ` и ` npm run db:push`.
          </div>
        </div>
      )}

      <section className="app-section">
        <div className="app-section-head">
          <div>
            <h2>События</h2>
            <p className="app-muted">Открытые, закрытые и уже рассчитанные события.</p>
          </div>
        </div>

        {events.length === 0 ? (
          <div className="card app-empty">
            Пока нет опубликованных событий. После входа первым пользователем вы сможете открыть админ-панель и создать первое событие.
          </div>
        ) : (
          <div className="row">
            {events.map((event) => (
              <div key={event.id} className="col-12 col-6-lg">
                <Link href={`/events/${event.slug}`} className="app-card-link">
                  <article className="card app-event-card">
                    {event.imagePath ? (
                      <Image
                        src={event.imagePath}
                        alt={event.title}
                        width={1200}
                        height={480}
                        className="app-image"
                      />
                    ) : (
                      <div className="app-image-placeholder">Изображение не загружено</div>
                    )}

                    <div className="app-card-meta app-card-meta-spaced">
                      <span className={`tag app-status ${statusClass(event.status)}`}>
                        {statusLabel(event.status)}
                      </span>
                      <span className="app-muted">
                        {formatDateTime(event.publishedAt ?? event.createdAt)}
                      </span>
                    </div>

                    <h3>{event.title}</h3>
                    <p className="app-muted">{event.description}</p>
                    <p className="app-note">{event.conditionText}</p>

                    <div className="app-outcome-grid">
                      {event.outcomes.map((outcome) => (
                        <div key={outcome.id} className="app-outcome-card">
                          <div className="app-outcome-head">
                            <strong>{outcome.label}</strong>
                            <span>{formatPercent(Number(outcome.probabilityPercent))}</span>
                          </div>
                          <ProbabilityTrend
                            initial={Number(outcome.initialProbabilityPercent)}
                            current={Number(outcome.probabilityPercent)}
                          />
                          <div className="app-outcome-meta">
                            Прогнозов: {outcome.predictionCount}
                          </div>
                        </div>
                      ))}
                    </div>

                    <footer className="app-card-footer">
                      <span className="app-muted">Прогнозов: {event._count.predictions}</span>
                    </footer>
                  </article>
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
