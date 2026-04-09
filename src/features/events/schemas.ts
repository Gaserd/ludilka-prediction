import { EventStatus } from "@prisma/client";
import { z } from "zod";

const optionalUrl = z.union([z.literal(""), z.url("Введите корректный URL.")]);

const outcomeSchema = z.object({
  label: z.string().trim().min(1, "Укажите название исхода."),
  probabilityPercent: z
    .number()
    .positive("Вероятность должна быть больше 0.")
    .max(100, "Вероятность не может быть выше 100."),
});

export const eventFormSchema = z
  .object({
    title: z.string().trim().min(3, "Укажите название события."),
    description: z.string().trim().min(10, "Добавьте подробное описание."),
    conditionText: z.string().trim().min(10, "Опишите условие выполнения."),
    sourceUrl: optionalUrl,
    sourceType: z.string().trim().max(100).optional(),
    externalEntityId: z.string().trim().max(100).optional(),
    status: z.nativeEnum(EventStatus),
    closesAt: z.string().optional(),
    outcomes: z.array(outcomeSchema).min(2, "Добавьте минимум два исхода."),
  })
  .superRefine((value, ctx) => {
    const total = value.outcomes.reduce(
      (sum, outcome) => sum + outcome.probabilityPercent,
      0,
    );

    if (Math.abs(total - 100) > 0.01) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Сумма вероятностей должна быть ровно 100%.",
        path: ["outcomes"],
      });
    }
  });

export const resolutionSchema = z.object({
  eventId: z.string().min(1),
  winningOutcomeId: z.string().min(1, "Выберите победивший исход."),
  proofUrl: optionalUrl,
  notes: z.string().trim().max(1000).optional(),
});

export function parseEventFormData(formData: FormData) {
  const labels = formData.getAll("outcomeLabel");
  const probabilities = formData.getAll("outcomeProbability");

  const outcomes = labels
    .map((label, index) => ({
      label: String(label ?? "").trim(),
      probabilityPercent: Number(String(probabilities[index] ?? "0")),
    }))
    .filter((item) => item.label.length > 0);

  return eventFormSchema.safeParse({
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? ""),
    conditionText: String(formData.get("conditionText") ?? ""),
    sourceUrl: String(formData.get("sourceUrl") ?? ""),
    sourceType: String(formData.get("sourceType") ?? ""),
    externalEntityId: String(formData.get("externalEntityId") ?? ""),
    status: String(formData.get("status") ?? EventStatus.DRAFT),
    closesAt: String(formData.get("closesAt") ?? ""),
    outcomes,
  });
}
