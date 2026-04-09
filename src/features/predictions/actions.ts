"use server";

import { EventStatus, Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  buildPredictionCountMap,
  calculateMarketProbability,
} from "@/features/events/market";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/env";

const predictionSchema = z.object({
  eventId: z.string().min(1),
  outcomeId: z.string().min(1),
  slug: z.string().min(1),
  note: z.string().trim().max(280).optional(),
});

const predictionCommentSchema = z.object({
  predictionId: z.string().min(1),
  slug: z.string().min(1),
  body: z.string().trim().min(1).max(500),
});

export async function submitPredictionAction(formData: FormData) {
  const user = await requireUser();
  const slug = String(formData.get("slug") ?? "");

  if (!isDatabaseConfigured()) {
    redirect(`/events/${slug}?error=db`);
  }

  const parsed = predictionSchema.safeParse({
    eventId: String(formData.get("eventId") ?? ""),
    outcomeId: String(formData.get("outcomeId") ?? ""),
    slug,
    note: String(formData.get("note") ?? ""),
  });

  if (!parsed.success) {
    redirect(`/events/${slug}?error=invalid`);
  }

  const event = await db.event.findUnique({
    where: {
      id: parsed.data.eventId,
    },
    include: {
      outcomes: true,
      predictions: {
        select: {
          outcomeId: true,
        },
      },
    },
  });

  if (!event || event.slug !== parsed.data.slug) {
    redirect("/");
  }

  if (event.status !== EventStatus.PUBLISHED) {
    redirect(`/events/${event.slug}?error=closed`);
  }

  const selectedOutcome = event.outcomes.find(
    (outcome) => outcome.id === parsed.data.outcomeId,
  );

  if (!selectedOutcome) {
    redirect(`/events/${event.slug}?error=outcome`);
  }

  const counts = buildPredictionCountMap(event.predictions);
  const lockedProbabilityPercent = calculateMarketProbability(
    Number(selectedOutcome.probabilityPercent),
    counts.get(selectedOutcome.id) ?? 0,
    event.predictions.length,
  );

  const existingPrediction = await db.prediction.findUnique({
    where: {
      userId_eventId: {
        userId: user.id,
        eventId: event.id,
      },
    },
    select: {
      id: true,
    },
  });

  if (existingPrediction) {
    redirect(`/events/${event.slug}?error=exists`);
  }

  try {
    await db.prediction.create({
      data: {
        userId: user.id,
        eventId: event.id,
        outcomeId: selectedOutcome.id,
        note: parsed.data.note || null,
        lockedProbabilityPercent,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      redirect(`/events/${event.slug}?error=exists`);
    }

    throw error;
  }

  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath(`/events/${event.slug}`);
  revalidatePath("/profile");
  redirect(`/events/${event.slug}?predicted=1`);
}

export async function addPredictionCommentAction(formData: FormData) {
  const user = await requireUser();
  const slug = String(formData.get("slug") ?? "");

  if (!isDatabaseConfigured()) {
    redirect(`/events/${slug}?error=db`);
  }

  const parsed = predictionCommentSchema.safeParse({
    predictionId: String(formData.get("predictionId") ?? ""),
    slug,
    body: String(formData.get("body") ?? ""),
  });

  if (!parsed.success) {
    redirect(`/events/${slug}?error=comment`);
  }

  const prediction = await db.prediction.findUnique({
    where: {
      id: parsed.data.predictionId,
    },
    select: {
      id: true,
      event: {
        select: {
          slug: true,
          status: true,
        },
      },
    },
  });

  if (!prediction || prediction.event.slug !== parsed.data.slug) {
    redirect(`/events/${slug}?error=commentMissing`);
  }

  if (
    prediction.event.status === EventStatus.DRAFT ||
    prediction.event.status === EventStatus.CANCELLED
  ) {
    redirect(`/events/${slug}?error=commentClosed`);
  }

  await db.predictionComment.create({
    data: {
      predictionId: prediction.id,
      authorId: user.id,
      body: parsed.data.body,
    },
  });

  revalidatePath(`/events/${prediction.event.slug}`);
  redirect(`/events/${prediction.event.slug}?commented=1#prediction-${prediction.id}`);
}
