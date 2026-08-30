# Проверка реализации: Follow-up и эксплуатационная надёжность

**Дата:** 30 августа 2026 года

**Результат:** PASS

## Что подтверждено

- Полный путь миграций `0000 → 0001 → 0002` применён с нуля к отдельной PostgreSQL 17 базе.
- Миграция `0002_follow_up_notifications.sql` успешно применена к staging Neon.
- Параллельный claim создаёт не более одной follow-up доставки на сессию.
- Сохранённый до срока ответ исключает сообщение; гонка ответа перед отправкой даёт `skipped`.
- Доставка старше 60 минут пропускается, а её задержка отражается в агрегированной сводке.
- Ошибка одной отправки не останавливает остальные сообщения batch.
- Пересекающийся HTTP-run получает 409; Bearer-защита и 401/503 сохранены.
- Очистка удаляет только wake/follow-up delivery logs старше 90 дней. Сессии и follow-up
  observations сохраняются; повторная очистка идемпотентна.
- Production bundle не содержит серверных секретов или тестовых launch data.

## Выполненные команды

```text
pnpm format:check                                      PASS
pnpm typecheck                                         PASS
pnpm test                                              PASS
DATABASE_URL=<local-postgres> pnpm test:integration    PASS (8 тестов)
pnpm build                                             PASS
pnpm verify:web-bundle                                 PASS (220,3 КБ из 250 КБ)
pnpm verify:production                                 PASS
pnpm test:e2e                                          PASS (7 тестов)
pnpm db:migrate                                        PASS (staging Neon)
```

Стандартный workspace-suite подтвердил 47 тестов, отдельный PostgreSQL integration-suite — 8
тестов, mobile E2E-suite — 7 тестов.

## Оставшаяся ручная staging-проверка

После deploy ветки `dev` завершить реальный wake-протокол в `@wake_coach_bot`, не отвечать на
follow-up внутри Mini App и подтвердить одно сообщение через 15–20 минут. Затем открыть кнопку,
сохранить ответ и убедиться, что следующие cron-запуски не создают дубль.

Это внешняя проверка фактической доставки Telegram и времени бесплатного Render; она не может быть
надёжно воспроизведена локальным автоматическим тестом.
