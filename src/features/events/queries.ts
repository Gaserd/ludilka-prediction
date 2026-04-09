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

export type AdminDashboardData = {
  admins: Array<{
    id: string;
    name: string;
    email: string;
    createdAt: Date;
  }>;
  events: Array<{
    id: string;
    title: string;
    slug: string;
    description: string;
    conditionText: string;
    status: EventStatus;
    createdAt: Date;
    publishedAt: Date | null;
    _count: {
      predictions: number;
    };
    outcomes: Array<{
      id: string;
      label: string;
      probabilityPercent: number;
      initialProbabilityPercent: number;
      predictionCount: number;
    }>;
    resolution: null | {
      winningOutcomeId: string;
      resolvedAt: Date;
      winningOutcome: {
        label: string;
      };
    };
  }>;
};

export type PublicEventListItem = {
  id: string;
  slug: string;
  title: string;
  description: string;
  conditionText: string;
  imagePath: string | null;
  status: EventStatus;
  createdAt: Date;
  publishedAt: Date | null;
  _count: {
    predictions: number;
  };
  outcomes: Array<{
    id: string;
    label: string;
    probabilityPercent: number;
    initialProbabilityPercent: number;
    predictionCount: number;
  }>;
  resolution: null | {
    winningOutcomeId: string;
    resolvedAt: Date;
    winningOutcome: {
      label: string;
    };
  };
};

export type PublicEventDetails = {
  id: string;
  slug: string;
  title: string;
  description: string;
  conditionText: string;
  imagePath: string | null;
  sourceUrl: string | null;
  sourceType: string | null;
  externalEntityId: string | null;
  status: EventStatus;
  createdAt: Date;
  publishedAt: Date | null;
  closesAt: Date | null;
  outcomes: Array<{
    id: string;
    label: string;
    probabilityPercent: number;
    initialProbabilityPercent: number;
    predictionCount: number;
  }>;
  predictions: Array<{
    id: string;
    userId: string;
    outcomeId: string;
    note: string | null;
    createdAt: Date;
    updatedAt: Date;
    lockedProbabilityPercent: number;
    commentCount: number;
    user: {
      id: string;
      name: string;
    };
    outcome: {
      id: string;
      label: string;
      probabilityPercent: number;
    };
    comments: Array<{
      id: string;
      body: string;
      createdAt: Date;
      author: {
        id: string;
        name: string;
      };
    }>;
  }>;
  resolution: null | {
    winningOutcomeId: string;
    resolvedAt: Date;
    notes: string | null;
    winningOutcome: {
      label: string;
    };
  };
  marketHistory: Array<{
    at: Date;
    outcomes: Array<{
      id: string;
      label: string;
      probabilityPercent: number;
    }>;
  }>;
};

export type EditableEventData = {
  id: string;
  title: string;
  description: string;
  conditionText: string;
  sourceUrl: string | null;
  sourceType: string | null;
  externalEntityId: string | null;
  status: EventStatus;
  closesAt: Date | null;
  imagePath: string | null;
  outcomes: Array<{
    id: string;
    label: string;
    probabilityPercent: number;
    initialProbabilityPercent: number;
    predictionCount: number;
  }>;
};

export type UserPredictionHistoryItem = {
  id: string;
  note: string | null;
  updatedAt: Date;
  outcome: {
    label: string;
  };
  event: {
    slug: string;
    title: string;
    status: EventStatus;
    resolution: null | {
      winningOutcome: {
        label: string;
      };
    };
  };
};

export async function getPublicEvents(): Promise<PublicEventListItem[]> {
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
    resolution: event.resolution,
  }));
}

export async function getPublicEventBySlug(
  slug: string,
): Promise<PublicEventDetails | null> {
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
    resolution: event.resolution,
    marketHistory: timeline.timeline,
  };
}

export async function getAdminDashboardData(): Promise<AdminDashboardData> {
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
      resolution: event.resolution,
    })),
  };
}

export async function getEditableEventById(
  id: string,
): Promise<EditableEventData | null> {
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

export async function getUserPredictions(
  userId: string,
): Promise<UserPredictionHistoryItem[]> {
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
