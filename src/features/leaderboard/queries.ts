import { EventStatus } from "@prisma/client";

import { db } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/env";
import { buildMarketTimeline, type MarketBaseOutcome } from "@/features/events/market";

export type ProfitLeaderboardEntry = {
  userId: string;
  userName: string;
  resolvedPredictions: number;
  wins: number;
  losses: number;
  hitRate: number;
  totalProfit: number;
  roiPercent: number;
  averageOdds: number;
  currentStreak: number;
  bestStreak: number;
};

export type StreakLeaderboardEntry = {
  userId: string;
  userName: string;
  resolvedPredictions: number;
  wins: number;
  losses: number;
  hitRate: number;
  currentStreak: number;
  bestStreak: number;
};

type LeaderboardAccumulator = {
  userId: string;
  userName: string;
  resolvedPredictions: number;
  wins: number;
  losses: number;
  totalProfit: number;
  totalOdds: number;
  resolvedHistory: Array<{
    resolvedAt: Date;
    isWin: boolean;
  }>;
};

function roundValue(value: number) {
  return Number(value.toFixed(2));
}

function calculateDecimalOdds(probabilityPercent: number) {
  if (probabilityPercent <= 0) {
    return 0;
  }

  return 100 / probabilityPercent;
}

function computeStreakStats(
  history: Array<{
    resolvedAt: Date;
    isWin: boolean;
  }>,
) {
  const sortedHistory = [...history].sort(
    (left, right) => left.resolvedAt.getTime() - right.resolvedAt.getTime(),
  );

  let current = 0;
  let best = 0;

  for (const result of sortedHistory) {
    if (result.isWin) {
      current += 1;
      best = Math.max(best, current);
    } else {
      current = 0;
    }
  }

  return {
    currentStreak: current,
    bestStreak: best,
  };
}

function normalizeBaseOutcomes(
  outcomes: Array<{ id: string; label: string; probabilityPercent: unknown }>,
): MarketBaseOutcome[] {
  return outcomes.map((outcome) => ({
    id: outcome.id,
    label: outcome.label,
    probabilityPercent: Number(outcome.probabilityPercent),
  }));
}

function toProfitEntry(accumulator: LeaderboardAccumulator): ProfitLeaderboardEntry {
  const { currentStreak, bestStreak } = computeStreakStats(accumulator.resolvedHistory);
  const resolvedPredictions = accumulator.resolvedPredictions;
  const hitRate =
    resolvedPredictions === 0 ? 0 : (accumulator.wins / resolvedPredictions) * 100;

  return {
    userId: accumulator.userId,
    userName: accumulator.userName,
    resolvedPredictions,
    wins: accumulator.wins,
    losses: accumulator.losses,
    hitRate: roundValue(hitRate),
    totalProfit: roundValue(accumulator.totalProfit),
    roiPercent: roundValue(
      resolvedPredictions === 0
        ? 0
        : (accumulator.totalProfit / resolvedPredictions) * 100,
    ),
    averageOdds: roundValue(
      resolvedPredictions === 0
        ? 0
        : accumulator.totalOdds / resolvedPredictions,
    ),
    currentStreak,
    bestStreak,
  };
}

function toStreakEntry(accumulator: LeaderboardAccumulator): StreakLeaderboardEntry {
  const { currentStreak, bestStreak } = computeStreakStats(accumulator.resolvedHistory);
  const resolvedPredictions = accumulator.resolvedPredictions;
  const hitRate =
    resolvedPredictions === 0 ? 0 : (accumulator.wins / resolvedPredictions) * 100;

  return {
    userId: accumulator.userId,
    userName: accumulator.userName,
    resolvedPredictions,
    wins: accumulator.wins,
    losses: accumulator.losses,
    hitRate: roundValue(hitRate),
    currentStreak,
    bestStreak,
  };
}

export async function getLeaderboardData() {
  if (!isDatabaseConfigured()) {
    return {
      profitability: [] as ProfitLeaderboardEntry[],
      streaks: [] as StreakLeaderboardEntry[],
    };
  }

  const resolvedEvents = await db.event.findMany({
    where: {
      status: EventStatus.RESOLVED,
      resolution: {
        isNot: null,
      },
    },
    include: {
      outcomes: {
        orderBy: {
          displayOrder: "asc",
        },
      },
      resolution: {
        select: {
          resolvedAt: true,
          winningOutcomeId: true,
        },
      },
      predictions: {
        select: {
          id: true,
          userId: true,
          outcomeId: true,
          lockedProbabilityPercent: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: "asc",
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  const accumulators = new Map<string, LeaderboardAccumulator>();

  for (const event of resolvedEvents) {
    if (!event.resolution) {
      continue;
    }

    const marketTimeline = buildMarketTimeline({
      outcomes: normalizeBaseOutcomes(event.outcomes),
      predictions: event.predictions.map((prediction) => ({
        id: prediction.id,
        outcomeId: prediction.outcomeId,
        createdAt: prediction.createdAt,
      })),
      initialTimestamp: event.publishedAt ?? event.createdAt,
    });

    for (const prediction of event.predictions) {
      const accumulator =
        accumulators.get(prediction.userId) ??
        {
          userId: prediction.user.id,
          userName: prediction.user.name,
          resolvedPredictions: 0,
          wins: 0,
          losses: 0,
          totalProfit: 0,
          totalOdds: 0,
          resolvedHistory: [],
        };

      const lockedProbabilityPercent =
        prediction.lockedProbabilityPercent != null
          ? Number(prediction.lockedProbabilityPercent)
          : marketTimeline.lockedProbabilityByPredictionId.get(prediction.id) ??
            50;

      const decimalOdds = calculateDecimalOdds(lockedProbabilityPercent);
      const isWin = prediction.outcomeId === event.resolution.winningOutcomeId;
      const profitDelta = isWin ? decimalOdds - 1 : -1;

      accumulator.resolvedPredictions += 1;
      accumulator.totalOdds += decimalOdds;
      accumulator.totalProfit += profitDelta;

      if (isWin) {
        accumulator.wins += 1;
      } else {
        accumulator.losses += 1;
      }

      accumulator.resolvedHistory.push({
        resolvedAt: event.resolution.resolvedAt,
        isWin,
      });

      accumulators.set(prediction.userId, accumulator);
    }
  }

  const profitEntries = [...accumulators.values()]
    .map(toProfitEntry)
    .sort(
      (left, right) =>
        right.totalProfit - left.totalProfit ||
        right.wins - left.wins ||
        right.resolvedPredictions - left.resolvedPredictions ||
        left.userName.localeCompare(right.userName, "ru"),
    );

  const streakEntries = [...accumulators.values()]
    .map(toStreakEntry)
    .sort(
      (left, right) =>
        right.bestStreak - left.bestStreak ||
        right.currentStreak - left.currentStreak ||
        right.wins - left.wins ||
        right.resolvedPredictions - left.resolvedPredictions ||
        left.userName.localeCompare(right.userName, "ru"),
    );

  return {
    profitability: profitEntries,
    streaks: streakEntries,
  };
}
