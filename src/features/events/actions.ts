"use server";

import { EventStatus, Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/env";
import { actionError, type ActionState } from "@/lib/form-state";
import { saveEventImage } from "@/lib/storage";
import { slugify } from "@/lib/utils";
import {
  parseEventFormData,
  resolutionSchema,
} from "@/features/events/schemas";

function parseOptionalDate(value?: string) {
  if (!value) {
    return null;
  }

  return new Date(value);
}

async function generateUniqueSlug(title: string, currentEventId?: string) {
  const baseSlug = slugify(title) || "event";
  let candidate = baseSlug;
  let counter = 1;

  while (true) {
    const existing = await db.event.findUnique({
      where: {
        slug: candidate,
      },
      select: {
        id: true,
      },
    });

    if (!existing || existing.id === currentEventId) {
      return candidate;
    }

    counter += 1;
    candidate = `${baseSlug}-${counter}`;
  }
}

async function writeAuditLog(
  actorId: string,
  action: string,
  entityId: string,
  details?: Prisma.InputJsonValue,
) {
  await db.auditLog.create({
    data: {
      actorId,
      action,
      entityType: "Event",
      entityId,
      details,
    },
  });
}

export async function createEventAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!isDatabaseConfigured()) {
    return actionError("Сначала укажите DATABASE_URL в .env.");
  }

  const actor = await requireAdmin();
  const parsed = parseEventFormData(formData);

  if (!parsed.success) {
    return actionError(
      "Проверьте данные события.",
      parsed.error.flatten().fieldErrors,
    );
  }

  const imagePath = await saveEventImage(formData.get("image"));
  const slug = await generateUniqueSlug(parsed.data.title);

  const event = await db.event.create({
    data: {
      slug,
      title: parsed.data.title,
      description: parsed.data.description,
      conditionText: parsed.data.conditionText,
      imagePath,
      sourceUrl: parsed.data.sourceUrl || null,
      sourceType: parsed.data.sourceType || null,
      externalEntityId: parsed.data.externalEntityId || null,
      status: parsed.data.status,
      publishedAt:
        parsed.data.status === EventStatus.PUBLISHED ? new Date() : null,
      closesAt: parseOptionalDate(parsed.data.closesAt),
      createdById: actor.id,
      updatedById: actor.id,
      outcomes: {
        create: parsed.data.outcomes.map((outcome, index) => ({
          label: outcome.label,
          probabilityPercent: outcome.probabilityPercent,
          displayOrder: index,
        })),
      },
    },
  });

  await writeAuditLog(actor.id, "event.created", event.id, {
    status: event.status,
    slug: event.slug,
  });

  revalidatePath("/");
  revalidatePath("/admin");
  redirect("/admin?eventCreated=1");
}

export async function updateDraftEventAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!isDatabaseConfigured()) {
    return actionError("Сначала укажите DATABASE_URL в .env.");
  }

  const actor = await requireAdmin();
  const eventId = String(formData.get("eventId") ?? "");
  const existing = await db.event.findUnique({
    where: {
      id: eventId,
    },
    include: {
      _count: {
        select: {
          predictions: true,
        },
      },
    },
  });

  if (!existing) {
    return actionError("Событие не найдено.");
  }

  if (existing.status !== EventStatus.DRAFT) {
    return actionError("Редактировать можно только черновики.");
  }

  if (existing._count.predictions > 0) {
    return actionError("Нельзя менять исходы после появления прогнозов.");
  }

  const parsed = parseEventFormData(formData);

  if (!parsed.success) {
    return actionError(
      "Проверьте данные события.",
      parsed.error.flatten().fieldErrors,
    );
  }

  const slug = await generateUniqueSlug(parsed.data.title, existing.id);
  const nextImagePath =
    (await saveEventImage(formData.get("image"))) ?? existing.imagePath;

  await db.$transaction(async (tx) => {
    await tx.event.update({
      where: {
        id: existing.id,
      },
      data: {
        slug,
        title: parsed.data.title,
        description: parsed.data.description,
        conditionText: parsed.data.conditionText,
        imagePath: nextImagePath,
        sourceUrl: parsed.data.sourceUrl || null,
        sourceType: parsed.data.sourceType || null,
        externalEntityId: parsed.data.externalEntityId || null,
        status: parsed.data.status,
        publishedAt:
          parsed.data.status === EventStatus.PUBLISHED
            ? existing.publishedAt ?? new Date()
            : null,
        closesAt: parseOptionalDate(parsed.data.closesAt),
        updatedById: actor.id,
      },
    });

    await tx.eventOutcome.deleteMany({
      where: {
        eventId: existing.id,
      },
    });

    await tx.eventOutcome.createMany({
      data: parsed.data.outcomes.map((outcome, index) => ({
        eventId: existing.id,
        label: outcome.label,
        probabilityPercent: outcome.probabilityPercent,
        displayOrder: index,
      })),
    });

    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: "event.updated",
        entityType: "Event",
        entityId: existing.id,
        details: {
          status: parsed.data.status,
          slug,
        },
      },
    });
  });

  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath(`/events/${slug}`);
  redirect("/admin?eventUpdated=1");
}

export async function changeEventStatusAction(formData: FormData) {
  if (!isDatabaseConfigured()) {
    redirect("/admin?statusError=db");
  }

  const actor = await requireAdmin();
  const eventId = String(formData.get("eventId") ?? "");
  const targetStatus = String(formData.get("status") ?? "");

  if (!eventId || !Object.values(EventStatus).includes(targetStatus as EventStatus)) {
    redirect("/admin?statusError=invalid");
  }

  const event = await db.event.findUnique({
    where: {
      id: eventId,
    },
  });

  if (!event) {
    redirect("/admin?statusError=missing");
  }

  const nextStatus = targetStatus as EventStatus;
  const validTransitions: Record<EventStatus, EventStatus[]> = {
    DRAFT: [EventStatus.PUBLISHED, EventStatus.CANCELLED],
    PUBLISHED: [EventStatus.CLOSED, EventStatus.CANCELLED],
    CLOSED: [EventStatus.CANCELLED],
    RESOLVED: [],
    CANCELLED: [],
  };

  if (!validTransitions[event.status].includes(nextStatus)) {
    redirect("/admin?statusError=transition");
  }

  await db.event.update({
    where: {
      id: event.id,
    },
    data: {
      status: nextStatus,
      publishedAt:
        nextStatus === EventStatus.PUBLISHED
          ? event.publishedAt ?? new Date()
          : event.publishedAt,
      updatedById: actor.id,
    },
  });

  await writeAuditLog(actor.id, "event.status.changed", event.id, {
    from: event.status,
    to: nextStatus,
  });

  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath(`/events/${event.slug}`);
  redirect("/admin?statusChanged=1");
}

export async function resolveEventAction(formData: FormData) {
  if (!isDatabaseConfigured()) {
    redirect("/admin?resolveError=db");
  }

  const actor = await requireAdmin();
  const parsed = resolutionSchema.safeParse({
    eventId: String(formData.get("eventId") ?? ""),
    winningOutcomeId: String(formData.get("winningOutcomeId") ?? ""),
    proofUrl: String(formData.get("proofUrl") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  });

  if (!parsed.success) {
    redirect("/admin?resolveError=invalid");
  }

  const event = await db.event.findUnique({
    where: {
      id: parsed.data.eventId,
    },
    include: {
      outcomes: true,
    },
  });

  if (!event) {
    redirect("/admin?resolveError=missing");
  }

  const winningOutcome = event.outcomes.find(
    (outcome) => outcome.id === parsed.data.winningOutcomeId,
  );

  if (!winningOutcome) {
    redirect("/admin?resolveError=outcome");
  }

  await db.$transaction(async (tx) => {
    await tx.eventResolution.upsert({
      where: {
        eventId: event.id,
      },
      update: {
        winningOutcomeId: winningOutcome.id,
        resolvedById: actor.id,
        proofUrl: parsed.data.proofUrl || null,
        notes: parsed.data.notes || null,
        resolvedAt: new Date(),
      },
      create: {
        eventId: event.id,
        winningOutcomeId: winningOutcome.id,
        resolvedById: actor.id,
        proofUrl: parsed.data.proofUrl || null,
        notes: parsed.data.notes || null,
      },
    });

    await tx.event.update({
      where: {
        id: event.id,
      },
      data: {
        status: EventStatus.RESOLVED,
        updatedById: actor.id,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: "event.resolved",
        entityType: "Event",
        entityId: event.id,
        details: {
          winningOutcomeId: winningOutcome.id,
        },
      },
    });
  });

  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath(`/events/${event.slug}`);
  redirect("/admin?resolved=1");
}
