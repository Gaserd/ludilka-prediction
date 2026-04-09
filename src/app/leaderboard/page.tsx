import Link from "next/link";

import {
  getLeaderboardData,
  type ProfitLeaderboardEntry,
  type StreakLeaderboardEntry,
} from "@/features/leaderboard/queries";

export const dynamic = "force-dynamic";

type LeaderboardPageProps = {
  searchParams?: Promise<{
    tab?: string;
  }>;
};

const tabItems = [
  { id: "profit", label: "По прибыльности" },
  { id: "streak", label: "По стрикам" },
] as const;

function isPositive(value: number) {
  return value > 0;
}

function formatSignedValue(value: number) {
  const abs = Math.abs(value).toFixed(2);

  if (value > 0) {
    return `+${abs}`;
  }

  if (value < 0) {
    return `-${abs}`;
  }

  return "0.00";
}

function ProfitabilityMobileList({ entries }: { entries: ProfitLeaderboardEntry[] }) {
  return (
    <div className="app-leaderboard-mobile-list">
      {entries.map((entry, index) => (
        <article key={entry.userId} className="card app-leaderboard-mobile-card">
          <div className="app-card-meta">
            <div>
              <span className="app-rank-badge">#{index + 1}</span>
              <h3 className="app-leaderboard-mobile-name">{entry.userName}</h3>
            </div>
            <div
              className={
                isPositive(entry.totalProfit) ? "app-profit-positive" : "app-profit-negative"
              }
            >
              {formatSignedValue(entry.totalProfit)}
            </div>
          </div>

          <div className="app-leaderboard-mobile-stats">
            <div>
              <span className="app-note-label">ROI</span>
              <strong
                className={
                  isPositive(entry.roiPercent) ? "app-profit-positive" : "app-profit-negative"
                }
              >
                {formatSignedValue(entry.roiPercent)}%
              </strong>
            </div>
            <div>
              <span className="app-note-label">Винрейт</span>
              <strong>{entry.hitRate.toFixed(2)}%</strong>
            </div>
            <div>
              <span className="app-note-label">Побед / поражений</span>
              <strong>
                {entry.wins} / {entry.losses}
              </strong>
            </div>
            <div>
              <span className="app-note-label">Средний коэф.</span>
              <strong>{entry.averageOdds.toFixed(2)}</strong>
            </div>
            <div>
              <span className="app-note-label">Текущий стрик</span>
              <strong>{entry.currentStreak}</strong>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function StreakMobileList({ entries }: { entries: StreakLeaderboardEntry[] }) {
  return (
    <div className="app-leaderboard-mobile-list">
      {entries.map((entry, index) => (
        <article key={entry.userId} className="card app-leaderboard-mobile-card">
          <div className="app-card-meta">
            <div>
              <span className="app-rank-badge">#{index + 1}</span>
              <h3 className="app-leaderboard-mobile-name">{entry.userName}</h3>
            </div>
            <div className="app-leaderboard-streak-badge">
              Лучший: <strong>{entry.bestStreak}</strong>
            </div>
          </div>

          <div className="app-leaderboard-mobile-stats">
            <div>
              <span className="app-note-label">Текущий стрик</span>
              <strong>{entry.currentStreak}</strong>
            </div>
            <div>
              <span className="app-note-label">Винрейт</span>
              <strong>{entry.hitRate.toFixed(2)}%</strong>
            </div>
            <div>
              <span className="app-note-label">Побед / поражений</span>
              <strong>
                {entry.wins} / {entry.losses}
              </strong>
            </div>
            <div>
              <span className="app-note-label">Рассчитано событий</span>
              <strong>{entry.resolvedPredictions}</strong>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function ProfitabilityTable({ entries }: { entries: ProfitLeaderboardEntry[] }) {
  return (
    <div className="card app-table-card">
      <ProfitabilityMobileList entries={entries} />
      <div className="app-table-wrap">
        <table className="striped app-leaderboard-table">
          <thead>
            <tr>
              <th>Место</th>
              <th>Игрок</th>
              <th>Профит</th>
              <th>ROI</th>
              <th>Винрейт</th>
              <th>Побед / поражений</th>
              <th>Средний коэф.</th>
              <th>Текущий стрик</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, index) => (
              <tr key={entry.userId}>
                <td>
                  <span className="app-rank-badge">#{index + 1}</span>
                </td>
                <td>
                  <strong>{entry.userName}</strong>
                </td>
                <td
                  className={
                    isPositive(entry.totalProfit) ? "app-profit-positive" : "app-profit-negative"
                  }
                >
                  {formatSignedValue(entry.totalProfit)}
                </td>
                <td
                  className={
                    isPositive(entry.roiPercent) ? "app-profit-positive" : "app-profit-negative"
                  }
                >
                  {formatSignedValue(entry.roiPercent)}%
                </td>
                <td>{entry.hitRate.toFixed(2)}%</td>
                <td>
                  {entry.wins} / {entry.losses}
                </td>
                <td>{entry.averageOdds.toFixed(2)}</td>
                <td>{entry.currentStreak}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="app-table-note">
        Прибыльность считается по уже рассчитанным событиям в модели flat stake: каждая ставка
        равна 1 юниту, выигрыш дает <strong>коэффициент - 1</strong>, проигрыш дает{" "}
        <strong>-1</strong>.
      </p>
    </div>
  );
}

function StreakTable({ entries }: { entries: StreakLeaderboardEntry[] }) {
  return (
    <div className="card app-table-card">
      <StreakMobileList entries={entries} />
      <div className="app-table-wrap">
        <table className="striped app-leaderboard-table">
          <thead>
            <tr>
              <th>Место</th>
              <th>Игрок</th>
              <th>Лучший стрик</th>
              <th>Текущий стрик</th>
              <th>Винрейт</th>
              <th>Побед / поражений</th>
              <th>Рассчитано событий</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, index) => (
              <tr key={entry.userId}>
                <td>
                  <span className="app-rank-badge">#{index + 1}</span>
                </td>
                <td>
                  <strong>{entry.userName}</strong>
                </td>
                <td>{entry.bestStreak}</td>
                <td>{entry.currentStreak}</td>
                <td>{entry.hitRate.toFixed(2)}%</td>
                <td>
                  {entry.wins} / {entry.losses}
                </td>
                <td>{entry.resolvedPredictions}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="app-table-note">
        После неверного прогноза текущий стрик сбрасывается, но лучший результат игрока остается в
        таблице.
      </p>
    </div>
  );
}

export default async function LeaderboardPage({ searchParams }: LeaderboardPageProps) {
  const params = (await searchParams) ?? {};
  const activeTab = params.tab === "streak" ? "streak" : "profit";
  const leaderboard = await getLeaderboardData();
  const activeEntries =
    activeTab === "streak" ? leaderboard.streaks : leaderboard.profitability;

  return (
    <div className="container app-page">
      <section className="card app-hero">
        <span className="tag app-soft-tag">Лидерборд</span>
        <h1 className="app-hero-title">Лучшие прогнозисты платформы</h1>
        <p className="app-hero-copy">
          Здесь можно посмотреть топ по прибыльности и отдельный рейтинг по лучшим сериям подряд
          угаданных событий.
        </p>
      </section>

      <section className="app-section">
        <div className="app-section-head">
          <div>
            <h2>Рейтинг игроков</h2>
            <p className="app-muted">
              В таблицы попадают только уже рассчитанные события с известным исходом.
            </p>
          </div>

          <div className="tabs app-tabs app-tabs-inline">
            {tabItems.map((tab) => {
              const isActive = tab.id === activeTab;

              return (
                <Link
                  key={tab.id}
                  href={tab.id === "profit" ? "/leaderboard" : `/leaderboard?tab=${tab.id}`}
                  className={isActive ? "active" : undefined}
                >
                  {tab.label}
                </Link>
              );
            })}
          </div>
        </div>

        {activeEntries.length === 0 ? (
          <div className="card app-empty">
            Пока нет рассчитанных событий, поэтому лидерборд еще не заполнен.{" "}
            <Link href="/" className="button outline">
              Перейти к событиям
            </Link>
          </div>
        ) : activeTab === "streak" ? (
          <StreakTable entries={leaderboard.streaks} />
        ) : (
          <ProfitabilityTable entries={leaderboard.profitability} />
        )}
      </section>
    </div>
  );
}
