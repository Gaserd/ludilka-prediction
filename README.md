# Ludilka Prediction

MVP-платформа на `Next.js` + `PostgreSQL` для:
- создания событий в админ-панели;
- задания условий и стартовых коэффициентов;
- регистрации пользователей и сохранения прогнозов;
- ручного завершения событий с заделом под будущую автоматизацию.

## Локальный запуск

1. Установите зависимости:

```bash
npm install
```

2. Проверьте `.env`.

Минимально важны:

```env
POSTGRES_DB="ludilka_prediction"
POSTGRES_USER="postgres"
POSTGRES_PASSWORD="your-password"
DATABASE_URL="postgresql://postgres:your-password@localhost:5432/ludilka_prediction?schema=public"
NEXTAUTH_URL="http://localhost:3000"
AUTH_SECRET="change-me-before-production"
```

3. Подготовьте базу и схему одной командой:

```bash
npm run setup
```

Эта команда:
- создаст базу, если ее еще нет;
- сгенерирует Prisma Client;
- применит текущую схему в PostgreSQL.

4. Запустите приложение:

```bash
npm run dev
```

## Проверка базы

Если нужно просто проверить синхронизацию схемы с БД:

```bash
npm run db:push
```

## Запуск одной командой через Docker

Для сервера или изолированного запуска можно поднять и приложение, и PostgreSQL вместе:

```bash
docker compose up --build -d
```

Что делает `docker compose`:
- поднимает контейнер `PostgreSQL`;
- собирает контейнер приложения;
- ждет готовности базы;
- применяет Prisma-схему;
- запускает `Next.js` в production-режиме.

Остановка:

```bash
docker compose down
```

Те же команды доступны через npm:

```bash
npm run docker:up
npm run docker:down
```

## Полезные команды

```bash
npm run lint
npm run typecheck
npm run build
npm run db:studio
```

## Примечания по деплою

- Для production обязательно поменяйте `AUTH_SECRET`.
- Для production лучше использовать отдельные значения `POSTGRES_PASSWORD`.
- Изображения событий в `docker compose` вынесены в отдельный volume, чтобы они не терялись при пересборке контейнера.
