"use client";

import Image from "next/image";
import { useActionState, useMemo } from "react";

import { ActionMessage } from "@/components/action-message";
import { SubmitButton } from "@/components/submit-button";
import { initialActionState, type ActionState } from "@/lib/form-state";
import { toDatetimeLocalValue } from "@/lib/utils";

type EventFormAction = (
  state: ActionState,
  formData: FormData,
) => Promise<ActionState>;

type EventFormProps = {
  action: EventFormAction;
  submitLabel: string;
  initialEvent?: {
    id: string;
    title: string;
    description: string;
    conditionText: string;
    sourceUrl: string | null;
    sourceType: string | null;
    externalEntityId: string | null;
    status: "DRAFT" | "PUBLISHED" | "CLOSED" | "RESOLVED" | "CANCELLED";
    closesAt: Date | string | null;
    imagePath: string | null;
    outcomes: Array<{
      label: string;
      probabilityPercent: number | string | { toString(): string };
    }>;
  };
};

const STATUSES = [
  { value: "DRAFT", label: "Черновик" },
  { value: "PUBLISHED", label: "Опубликовано" },
];

export function EventForm({
  action,
  submitLabel,
  initialEvent,
}: EventFormProps) {
  const [state, formAction] = useActionState(action, initialActionState);

  const outcomes = useMemo(() => {
    const base = initialEvent?.outcomes ?? [];
    return [
      ...base.map((outcome) => ({
        ...outcome,
        probabilityPercent: Number(outcome.probabilityPercent),
      })),
      ...Array.from({ length: Math.max(0, 4 - base.length) }, () => ({
        label: "",
        probabilityPercent: 0,
      })),
    ].slice(0, 4);
  }, [initialEvent?.outcomes]);

  return (
    <form action={formAction} className="card app-form">
      {initialEvent && <input type="hidden" name="eventId" value={initialEvent.id} />}

      <div>
        <h2>{initialEvent ? "Редактирование события" : "Создать событие"}</h2>
        <p className="app-muted">
          Опишите событие, задайте условия и укажите стартовые вероятности исходов.
        </p>
      </div>

      <ActionMessage message={state.message} />

      {initialEvent?.imagePath && (
        <div className="app-image-frame">
          <Image
            src={initialEvent.imagePath}
            alt={initialEvent.title}
            width={1200}
            height={480}
            className="app-image"
          />
        </div>
      )}

      <div className="app-form-grid">
        <label className="app-field app-field-full">
          <span className="app-field-title">Название события</span>
          <input
            type="text"
            name="title"
            defaultValue={initialEvent?.title ?? ""}
            required
          />
        </label>

        <label className="app-field app-field-full">
          <span className="app-field-title">Описание</span>
          <textarea
            name="description"
            defaultValue={initialEvent?.description ?? ""}
            rows={4}
            required
          />
        </label>

        <label className="app-field app-field-full">
          <span className="app-field-title">Условие события</span>
          <textarea
            name="conditionText"
            defaultValue={initialEvent?.conditionText ?? ""}
            rows={4}
            placeholder="Например: Игрок 1 сделает больше 19 убийств в матче X."
            required
          />
        </label>

        <label className="app-field">
          <span className="app-field-title">Статус</span>
          <select
            name="status"
            defaultValue={initialEvent?.status ?? "DRAFT"}
          >
            {STATUSES.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
        </label>

        <label className="app-field">
          <span className="app-field-title">Дата закрытия</span>
          <input
            type="datetime-local"
            name="closesAt"
            defaultValue={toDatetimeLocalValue(initialEvent?.closesAt)}
          />
        </label>

        <label className="app-field">
          <span className="app-field-title">Источник статистики</span>
          <input
            type="text"
            name="sourceType"
            defaultValue={initialEvent?.sourceType ?? ""}
            placeholder="HLTV, Liquipedia, manual"
          />
        </label>

        <label className="app-field">
          <span className="app-field-title">Внешний идентификатор</span>
          <input
            type="text"
            name="externalEntityId"
            defaultValue={initialEvent?.externalEntityId ?? ""}
            placeholder="match-12345"
          />
        </label>

        <label className="app-field app-field-full">
          <span className="app-field-title">URL источника</span>
          <input
            type="url"
            name="sourceUrl"
            defaultValue={initialEvent?.sourceUrl ?? ""}
            placeholder="https://..."
          />
        </label>

        <label className="app-field app-field-full">
          <span className="app-field-title">Изображение события</span>
          <input
            type="file"
            name="image"
            accept="image/*"
          />
        </label>
      </div>

      <div className="app-form-section">
        <div>
          <h3>Исходы и стартовые коэффициенты</h3>
          <p className="app-muted">
            Заполните минимум два исхода. Сумма вероятностей должна быть 100%.
          </p>
        </div>

        <div className="app-outcome-editor">
          {outcomes.map((outcome, index) => (
            <div key={`${outcome.label}-${index}`} className="card">
              <h4>Исход {index + 1}</h4>

              <label className="app-field">
                <span className="app-field-title">Название исхода</span>
                <input
                  type="text"
                  name="outcomeLabel"
                  defaultValue={outcome.label}
                  placeholder={index === 0 ? "Убьет" : index === 1 ? "Не убьет" : "Доп. исход"}
                />
              </label>

              <label className="app-field">
                <span className="app-field-title">Вероятность, %</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  name="outcomeProbability"
                  defaultValue={outcome.probabilityPercent || ""}
                  placeholder="50"
                />
              </label>
            </div>
          ))}
        </div>
      </div>

      <SubmitButton pendingLabel="Сохраняем событие...">
        {submitLabel}
      </SubmitButton>
    </form>
  );
}
