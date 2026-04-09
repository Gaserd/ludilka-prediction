import { hash } from "bcryptjs";
import { PrismaClient, EventStatus } from "@prisma/client";

const db = new PrismaClient();

const FAKE_USER_COUNT = 10;
const DEFAULT_PASSWORD = "fakepass123";
const FALLBACK_NOTES = [
  "Смотрю на текущую форму игрока.",
  "По статистике этот исход выглядит сильнее.",
  "Здесь вероятность кажется заниженной.",
  "Матчап хорошо подходит под этот вариант.",
  "Ожидаю плотную игру, но беру этот исход.",
  "Есть ощущение, что линия сместится именно сюда.",
  "По последним матчам этот исход выглядит надежно.",
  "Берусь за этот вариант из-за темпа игры.",
  "Скорее всего рынок уйдет в эту сторону.",
  "Риск есть, но потенциал хороший.",
];

const FAKE_NAMES = [
  "Артем Лайн",
  "Дима Пик",
  "Илья Статс",
  "Макс Роунд",
  "Никита Радар",
  "Саша Мета",
  "Егор Форма",
  "Павел Темп",
  "Роман Сплит",
  "Влад Скоуп",
];

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

async function resolveTargetEvent(slug) {
  if (slug) {
    return db.event.findUnique({
      where: { slug },
      include: {
        outcomes: {
          orderBy: { displayOrder: "asc" },
        },
      },
    });
  }

  return db.event.findFirst({
    where: {
      status: EventStatus.PUBLISHED,
    },
    include: {
      outcomes: {
        orderBy: { displayOrder: "asc" },
      },
    },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
  });
}

async function main() {
  const targetSlug = process.argv[2];
  const event = await resolveTargetEvent(targetSlug);

  if (!event) {
    throw new Error(
      targetSlug
        ? `Событие со slug "${targetSlug}" не найдено.`
        : "Не найдено ни одного опубликованного события для сидирования.",
    );
  }

  if (event.outcomes.length < 2) {
    throw new Error("У выбранного события недостаточно исходов для прогнозов.");
  }

  const passwordHash = await hash(DEFAULT_PASSWORD, 12);
  const fakeUsers = [];

  for (let index = 0; index < FAKE_USER_COUNT; index += 1) {
    const ordinal = String(index + 1).padStart(2, "0");
    const email = `fake.user.${ordinal}@seed.local`;
    const name = FAKE_NAMES[index] ?? `Фейковый пользователь ${ordinal}`;

    const user = await db.user.upsert({
      where: { email },
      update: {
        name,
        passwordHash,
        role: "USER",
      },
      create: {
        name,
        email,
        passwordHash,
        role: "USER",
      },
    });

    fakeUsers.push(user);
  }

  let createdPredictions = 0;
  let skippedPredictions = 0;

  for (const [index, user] of fakeUsers.entries()) {
    const existingPrediction = await db.prediction.findUnique({
      where: {
        userId_eventId: {
          userId: user.id,
          eventId: event.id,
        },
      },
      select: { id: true },
    });

    if (existingPrediction) {
      skippedPredictions += 1;
      continue;
    }

    const outcome = randomItem(event.outcomes);
    const shouldAttachNote = Math.random() > 0.3;

    await db.prediction.create({
      data: {
        userId: user.id,
        eventId: event.id,
        outcomeId: outcome.id,
        note: shouldAttachNote
          ? FALLBACK_NOTES[index % FALLBACK_NOTES.length]
          : null,
      },
    });

    createdPredictions += 1;
  }

  const outcomeStats = await db.prediction.groupBy({
    by: ["outcomeId"],
    where: {
      eventId: event.id,
      user: {
        email: {
          endsWith: "@seed.local",
        },
      },
    },
    _count: {
      outcomeId: true,
    },
  });

  const statsMap = new Map(
    outcomeStats.map((row) => [row.outcomeId, row._count.outcomeId]),
  );

  console.log(
    JSON.stringify(
      {
        event: {
          id: event.id,
          title: event.title,
          slug: event.slug,
        },
        fakeUsersTotal: fakeUsers.length,
        predictionsCreated: createdPredictions,
        predictionsSkipped: skippedPredictions,
        defaultPassword: DEFAULT_PASSWORD,
        outcomeDistribution: event.outcomes.map((outcome) => ({
          label: outcome.label,
          fakePredictions: statsMap.get(outcome.id) ?? 0,
        })),
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
