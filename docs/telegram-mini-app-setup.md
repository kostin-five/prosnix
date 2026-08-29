# Настройка Telegram-бота и запуск Adaptive Wake Coach как Mini App

Инструкция предназначена для staging и production. Обычный браузер без Telegram-контекста
покажет безопасную ошибку входа — это ожидаемое поведение. Demo доступен только локально.

## 1. Что понадобится

- публичный HTTPS-адрес, например `https://wake.example.com`;
- Node.js 22 и pnpm 11 на сервере или эквивалентный контейнерный хостинг;
- PostgreSQL 17;
- Telegram-аккаунт для [@BotFather](https://t.me/BotFather);
- отдельный бот для staging, чтобы тесты не затрагивали production.

Mini App и API размещаются под одним origin:

- `https://wake.example.com/` — содержимое `apps/web/dist`;
- `https://wake.example.com/api/*` — reverse proxy к Fastify API;
- `https://wake.example.com/health` — health endpoint API.

Клиент использует относительные `/api/*` URL и secure HTTP-only cookie. Разные домены для web и
API потребуют отдельного проектирования CORS/cookie и для первого релиза не рекомендуются.

## 2. Создание бота

1. Откройте [@BotFather](https://t.me/BotFather) и отправьте `/newbot`.
2. Укажите имя, например `Adaptive Wake Coach`.
3. Укажите уникальный username, оканчивающийся на `bot`, например
   `adaptive_wake_coach_bot`.
4. Сохраните токен в менеджере секретов хостинга.
5. Для staging повторите процесс с другим ботом и токеном.

Токен даёт полный контроль над ботом. Его нельзя добавлять в `VITE_*`, Git, клиентский JavaScript,
скриншоты или обычные сообщения. Если токен раскрыт, выпустите новый через `/token` в BotFather.

## 3. Production-переменные

Задайте их в панели хостинга, а не в репозитории:

```dotenv
NODE_ENV=production
API_PORT=3001
DATABASE_URL=postgres://USER:PASSWORD@HOST:5432/DATABASE
TELEGRAM_BOT_TOKEN=<TOKEN_ИЗ_BOTFATHER>
SESSION_SECRET=<СЛУЧАЙНАЯ_СТРОКА_НЕ_КОРОЧЕ_32_СИМВОЛОВ>
TELEGRAM_AUTH_MAX_AGE_SECONDS=900

# DeepSeek не блокирует первый Telegram-пилот
DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
```

Локальный `.env` уже исключён из Git. Для `SESSION_SECRET` используйте криптографически случайное
значение; не копируйте placeholder из `.env.example` в production.

## 4. Сборка и миграции

```bash
pnpm install --frozen-lockfile
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
pnpm verify:production
pnpm db:migrate
```

После сборки web находится в `apps/web/dist`, API запускается через `pnpm start:api`, а
`GET /health` должен вернуть `{"status":"ok"}`. Миграции сначала проверяйте на staging и
восстановленной копии базы по [инфраструктурной инструкции](../infra/README.md).

## 5. HTTPS и reverse proxy

Настройте хостинг так, чтобы:

1. `/` и статические файлы обслуживались из `apps/web/dist`;
2. неизвестные frontend-маршруты возвращали `index.html`;
3. `/api/*` и `/health` проксировались к `apps/api`;
4. внешний адрес работал только по HTTPS;
5. proxy не кешировал `/api/*` и передавал корректный host/protocol;
6. PostgreSQL не был публично доступен из интернета.

До настройки BotFather проверьте `https://wake.example.com/health`. При прямом открытии `/` в
браузере приложение должно попросить открыть его из Telegram.

## 6. Включение Main Mini App

1. В BotFather: `/mybots` → выберите бота.
2. Откройте `Bot Settings` → `Configure Mini App` → `Enable Mini App`.
3. Укажите полный URL `https://wake.example.com/`.
4. При необходимости настройте название, иконку и splash screen.
5. В профиле бота должна появиться кнопка запуска приложения.

Ссылка на Main Mini App:

```text
https://t.me/<BOT_USERNAME>?startapp
```

## 7. Кнопка меню в чате

1. Отправьте BotFather `/setmenubutton` или откройте
   `/mybots` → бот → `Bot Settings` → `Menu Button`.
2. Укажите текст `Открыть Wake Coach`.
3. Укажите тот же HTTPS URL.

Для первого пилота достаточно Main Mini App и menu button. Webhook/long polling не требуются,
пока бот не отвечает на сообщения и не отправляет напоминания. Исходящие follow-up сообщения —
отдельный следующий этап.

## 8. Оформление

В BotFather настройте `/setuserpic`, `/setdescription`, `/setabouttext` и previews Main Mini App.
Команду `/start` добавляйте в `/setcommands` только вместе с реальным обработчиком. До закрытой
беты опубликуйте политику конфиденциальности. Не позиционируйте продукт как медицинское лечение.

## 9. Smoke-test в Telegram

Открывайте `https://t.me/<BOT_USERNAME>?startapp`, а не обычный браузер.

1. Проверить запуск на Telegram iOS, Android и Desktop.
2. Начать протокол, сохранить стартовую оценку и одно задание.
3. Закрыть Mini App, открыть снова и продолжить с подтверждённого шага.
4. Завершить протокол и сохранить follow-up.
5. Проверить статистику, дату пересчёта и источники.
6. Повторить критический путь при кратком отключении сети.
7. Удалить тестовый профиль и убедиться, что повторный вход создаёт чистый профиль.

Ошибка `telegram_auth_failed` обычно означает, что URL открыт не из Telegram, токен принадлежит
другому боту, staging/production перепутаны, серверные часы расходятся или `initData` старше
`TELEGRAM_AUTH_MAX_AGE_SECONDS`.

## 10. Чеклист пилота

- [ ] staging и production используют разных ботов и базы;
- [ ] HTTPS-сертификат действителен;
- [ ] `pnpm verify:production` проходит;
- [ ] `/health` подключён к мониторингу;
- [ ] backup успешно восстановлен в изолированную базу;
- [ ] токены отсутствуют в web bundle и логах;
- [ ] Main Mini App и menu button ведут на актуальный URL;
- [ ] smoke-test пройден на iOS, Android и Desktop;
- [ ] опубликована политика конфиденциальности;
- [ ] подготовлен быстрый rollback приложения.

## Официальные источники

- [Создание и настройка ботов](https://core.telegram.org/bots/features#botfather)
- [Telegram Mini Apps](https://core.telegram.org/bots/webapps)
- [Main Mini Apps](https://core.telegram.org/api/bots/webapps#main-mini-apps)
- [Введение в Telegram Bots](https://core.telegram.org/bots)
