// Keep the starting market "heavy" enough so a single prediction
// nudges the probability instead of causing a sharp jump.
export const MARKET_PRIOR_WEIGHT = 40;

export type MarketBaseOutcome = {
  id: string;
  label: string;
  probabilityPercent: number;
};

export type MarketReplayPrediction = {
  id: string;
  outcomeId: string;
  createdAt: Date;
};

export type MarketSnapshot = {
  at: Date;
  outcomes: Array<{
    id: string;
    label: string;
    probabilityPercent: number;
  }>;
};

export function roundProbability(value: number) {
  return Number(value.toFixed(2));
}

export function calculateMarketProbability(
  initialProbabilityPercent: number,
  predictionCount: number,
  totalPredictions: number,
) {
  if (totalPredictions === 0) {
    return initialProbabilityPercent;
  }

  const priorVotes = (initialProbabilityPercent / 100) * MARKET_PRIOR_WEIGHT;

  return roundProbability(
    ((priorVotes + predictionCount) / (MARKET_PRIOR_WEIGHT + totalPredictions)) *
      100,
  );
}

export function buildPredictionCountMap(
  predictions: Array<Pick<MarketReplayPrediction, "outcomeId">>,
) {
  const counts = new Map<string, number>();

  for (const prediction of predictions) {
    counts.set(
      prediction.outcomeId,
      (counts.get(prediction.outcomeId) ?? 0) + 1,
    );
  }

  return counts;
}

export function buildCurrentMarketOutcomes(
  outcomes: MarketBaseOutcome[],
  predictions: Array<Pick<MarketReplayPrediction, "outcomeId">>,
) {
  const totalPredictions = predictions.length;
  const counts = buildPredictionCountMap(predictions);

  return outcomes.map((outcome) => ({
    ...outcome,
    initialProbabilityPercent: outcome.probabilityPercent,
    probabilityPercent: calculateMarketProbability(
      outcome.probabilityPercent,
      counts.get(outcome.id) ?? 0,
      totalPredictions,
    ),
    predictionCount: counts.get(outcome.id) ?? 0,
  }));
}

export function buildMarketTimeline(params: {
  outcomes: MarketBaseOutcome[];
  predictions: MarketReplayPrediction[];
  initialTimestamp: Date;
}) {
  const { outcomes, predictions, initialTimestamp } = params;
  const sortedPredictions = [...predictions].sort(
    (left, right) => left.createdAt.getTime() - right.createdAt.getTime(),
  );
  const counts = new Map<string, number>();
  const lockedProbabilityByPredictionId = new Map<string, number>();

  for (const outcome of outcomes) {
    counts.set(outcome.id, 0);
  }

  const timeline: MarketSnapshot[] = [
    {
      at: initialTimestamp,
      outcomes: outcomes.map((outcome) => ({
        id: outcome.id,
        label: outcome.label,
        probabilityPercent: outcome.probabilityPercent,
      })),
    },
  ];

  let totalPredictions = 0;

  for (const prediction of sortedPredictions) {
    const selectedOutcome = outcomes.find(
      (outcome) => outcome.id === prediction.outcomeId,
    );

    if (!selectedOutcome) {
      continue;
    }

    lockedProbabilityByPredictionId.set(
      prediction.id,
      calculateMarketProbability(
        selectedOutcome.probabilityPercent,
        counts.get(selectedOutcome.id) ?? 0,
        totalPredictions,
      ),
    );

    counts.set(
      prediction.outcomeId,
      (counts.get(prediction.outcomeId) ?? 0) + 1,
    );
    totalPredictions += 1;

    timeline.push({
      at: prediction.createdAt,
      outcomes: outcomes.map((outcome) => ({
        id: outcome.id,
        label: outcome.label,
        probabilityPercent: calculateMarketProbability(
          outcome.probabilityPercent,
          counts.get(outcome.id) ?? 0,
          totalPredictions,
        ),
      })),
    });
  }

  return {
    timeline,
    lockedProbabilityByPredictionId,
    currentOutcomes: outcomes.map((outcome) => ({
      ...outcome,
      initialProbabilityPercent: outcome.probabilityPercent,
      probabilityPercent: calculateMarketProbability(
        outcome.probabilityPercent,
        counts.get(outcome.id) ?? 0,
        totalPredictions,
      ),
      predictionCount: counts.get(outcome.id) ?? 0,
    })),
  };
}
