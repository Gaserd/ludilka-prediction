import { EventStatus } from "@prisma/client";

import { db } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/env";
import {
  buildCurrentMarketOutcomes,
  buildMarketTimeline,
  type MarketBaseOutcome,
} from "@/features/events/market";

function serializeOutcome<T extends { probabilityPercent: unknown }>(outcome: T) {
  return {
    ...outcome,
    probabilityPercent: Number(outcome.probabilityPercent),
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

function serializeResolution<
  T extends
    | {
        winningOutcome: { probabilityPercent: unknown };
      }
    | null
    | undefined,
>(resolution: T) {
  if (!resolution) {
    return resolution;
  }

  return {
    ...resolution,
    winningOutcome: serializeOutcome(resolution.winningOutcome),
  };
}

export async function getPublicEvents() {
  if (!isDatabaseConfigured()) {
    return [];
  }

  const events = await db.event.findMany({
    where: {
      status: {
        in: [EventStatus.PUBLISHED, EventStatus.CLOSED, EventStatus.RESOLVED],
      },
    },
    include: {
      outcomes: {
        orderBy: {
          displayOrder: "asc",
        },
      },
      predictions: {
        select: {
          outcomeId: true,
        },
      },
      resolution: {
        include: {
          winningOutcome: true,
        },
      },
      _count: {
        select: {
          predictions: true,
        },
      },
    },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
  });

  return events.map((event) => ({
    ...event,
    outcomes: buildCurrentMarketOutcomes(
      normalizeBaseOutcomes(event.outcomes),
      event.predictions,
    ),
    resolution: serializeResolution(event.resolution),
  }));
}

export async function getPublicEventBySlug(slug: string) {
  if (!isDatabaseConfigured()) {
    return null;
  }

  const event = await db.event.findUnique({
    where: {
      slug,
    },
    include: {
      outcomes: {
        orderBy: {
          displayOrder: "asc",
        },
      },
      predictions: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
            },
          },
          outcome: true,
          comments: {
            include: {
              author: {
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
      },
      resolution: {
        include: {
          winningOutcome: true,
        },
      },
      _count: {
        select: {
          predictions: true,
        },
      },
    },
  });

  if (
    !event ||
    event.status === EventStatus.DRAFT ||
    event.status === EventStatus.CANCELLED
  ) {
    return null;
  }

  const timeline = buildMarketTimeline({
    outcomes: normalizeBaseOutcomes(event.outcomes),
    predictions: event.predictions.map((prediction) => ({
      id: prediction.id,
      outcomeId: prediction.outcomeId,
      createdAt: prediction.createdAt,
    })),
    initialTimestamp: event.publishedAt ?? event.createdAt,
  });

  return {
    ...event,
    outcomes: timeline.currentOutcomes,
    predictions: event.predictions
      .map((prediction) => ({
        ...prediction,
        outcome: serializeOutcome(prediction.outcome),
        lockedProbabilityPercent:
          prediction.lockedProbabilityPercent != null
            ? Number(prediction.lockedProbabilityPercent)
            : timeline.lockedProbabilityByPredictionId.get(prediction.id) ??
              Number(prediction.outcome.probabilityPercent),
        commentCount: prediction.comments.length,
      }))
      .sort(
        (left, right) =>
          right.commentCount - left.commentCount ||
          right.comments.length - left.comments.length ||
          right.createdAt.getTime() - left.createdAt.getTime(),
      ),
    resolution: serializeResolution(event.resolution),
    marketHistory: timeline.timeline,
  };
}

export async function getAdminDashboardData() {
  if (!isDatabaseConfigured()) {
    return {
      admins: [],
      events: [],
    };
  }

  const [admins, events] = await Promise.all([
    db.user.findMany({
      where: {
        role: "ADMIN",
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
      },
    }),
    db.event.findMany({
      include: {
        outcomes: {
          orderBy: {
            displayOrder: "asc",
          },
        },
        predictions: {
          select: {
            outcomeId: true,
          },
        },
        resolution: {
          include: {
            winningOutcome: true,
          },
        },
        _count: {
          select: {
            predictions: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    }),
  ]);

  return {
    admins,
    events: events.map((event) => ({
      ...event,
      outcomes: buildCurrentMarketOutcomes(
        normalizeBaseOutcomes(event.outcomes),
        event.predictions,
      ),
      resolution: serializeResolution(event.resolution),
    })),
  };
}

export async function getEditableEventById(id: string) {
  if (!isDatabaseConfigured()) {
    return null;
  }

  const event = await db.event.findUnique({
    where: {
      id,
    },
    include: {
      outcomes: {
        orderBy: {
          displayOrder: "asc",
        },
      },
      predictions: {
        select: {
          outcomeId: true,
        },
      },
      _count: {
        select: {
          predictions: true,
        },
      },
    },
  });

  if (!event) {
    return null;
  }

  return {
    ...event,
    outcomes: buildCurrentMarketOutcomes(
      normalizeBaseOutcomes(event.outcomes),
      event.predictions,
    ),
  };
}

export async function getUserPredictions(userId: string) {
  if (!isDatabaseConfigured()) {
    return [];
  }

  return db.prediction.findMany({
    where: {
      userId,
    },
    include: {
      event: {
        include: {
          resolution: {
            include: {
              winningOutcome: true,
            },
          },
        },
      },
      outcome: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}
