# Понятная настройка Telegram-бота и Mini App

## Короткий ответ про токен

Если бот уже создан через BotFather и токен получен, **для первого запуска второго токена не
нужно**. Используем этого бота как staging-бота для разработки и небольшого технического пилота.

Второго бота и второй токен создадим перед публичным production-релизом. Так тестовые URL,
перезапуски и база не будут пересекаться с реальными пользователями.

Никогда не отправляйте токен в чат, не добавляйте его в Git и не вставляйте в переменные `VITE_*`.
Токен даёт полный контроль над ботом. Если он случайно опубликован, замените его через BotFather.

## Где именно выполняется каждое действие

| Место                    | Что там делаем                                                           |
| ------------------------ | ------------------------------------------------------------------------ |
| Компьютер, папка проекта | Разработка, локальный `.env`, тесты, сборка и Git                        |
| BotFather в Telegram     | Создание бота, получение токена, привязка HTTPS URL и кнопки Mini App    |
| Панель хостинга          | Создание API/web-сервиса, добавление переменных, запуск и просмотр логов |
| Управляемая PostgreSQL   | Хранение пользователей, сессий и аналитики; выдаёт `DATABASE_URL`        |
| DNS-панель домена        | Привязка домена к хостингу, если не используется адрес хостинга          |

«Менеджер секретов хостинга» — это не отдельная программа. Это раздел в панели вашего
API-сервиса, который обычно называется **Variables**, **Environment Variables**, **Environment**
или **Secrets**. В нём имя переменной вводится в левое поле, а секретное значение — в правое.
Хостинг передаёт эти значения серверу при запуске, но они не записываются в репозиторий.

## Что у нас есть сейчас, а чего ещё нет

Уже работают web, API, Neon, Telegram-аутентификация и бот `@wake_coach_bot`. Текущие адреса:

- Mini App: `https://wake-coach-1.onrender.com/`;
- API: `https://wake-coach.onrender.com/`;
- liveness: `https://wake-coach.onrender.com/health`;
- readiness с проверкой БД: `https://wake-coach.onrender.com/ready`.

Новая функция ежедневного Telegram-напоминания требует ещё одного ресурса Render — Cron Job.
Не указывайте в BotFather или Render `localhost` для staging.

## Перед началом: проверить Node.js и pnpm

Проект использует Node.js 22 и pnpm 11.19.0. Проверьте их в обычном Terminal:

```bash
node --version
pnpm --version
```

Ожидаются Node.js `v22.x` и pnpm `11.19.0`. Если Terminal пишет `command not found: pnpm`,
установите pnpm в пользовательскую папку без `sudo`:

```bash
npm install --global pnpm@11.19.0
source ~/.zshrc
pnpm --version
```

На текущем Mac это уже выполнено. Если старая вкладка Terminal всё ещё не видит `pnpm`, закройте
её и откройте новую либо выполните `source ~/.zshrc`.

## Шаг 1. Сохранить полученный токен локально

Работа выполняется **на компьютере** в файле:

```text
/Users/developer/Desktop/sleeep/.env
```

Откройте `.env` в редакторе и заполните значения:

```dotenv
NODE_ENV=development
API_PORT=3002
DATABASE_URL=postgres://awc:awc@localhost:5432/awc
POSTGRES_PORT=5432

TELEGRAM_BOT_TOKEN=вставьте_сюда_токен_из_BotFather
SESSION_SECRET=вставьте_сюда_случайную_строку
TELEGRAM_AUTH_MAX_AGE_SECONDS=900
TELEGRAM_WEB_APP_URL=https://wake-coach-1.onrender.com/

# Ключ нужен для AI-наставника; без него остальная аналитика продолжит работать.
DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-flash
DEEPSEEK_TIMEOUT_MS=12000
```

Сгенерировать `SESSION_SECRET` можно в Terminal:

```bash
openssl rand -hex 32
```

Скопируйте полученную строку в `SESSION_SECRET`. Не используйте сам Telegram-токен как
`SESSION_SECRET`.

Файл `.env` уже исключён из Git. Проверить это можно командой:

```bash
git status --ignored --short .env
```

Ожидаемый результат начинается с `!! .env` — это означает, что Git игнорирует файл.

API dev-скрипт автоматически читает корневой `.env`. Команды `set -a`, `source .env`, `set +a`
больше выполнять не нужно. После изменения `.env` достаточно остановить `pnpm dev` сочетанием
`Control+C` и запустить его снова.

## Шаг 2. Запустить проект локально

Откройте Terminal и выполните:

```bash
cd "/Users/developer/Desktop/sleeep"
pnpm install
pnpm db:start
pnpm db:migrate
pnpm dev
```

`pnpm install` нужен после первого скачивания проекта и после изменения зависимостей. Каждый день
его повторять не обязательно. `pnpm db:start` поднимает локальную PostgreSQL, `pnpm db:migrate`
применяет схему, а `pnpm dev` запускает web и API. После изменения `.env` перезапускайте
`pnpm dev`; миграции повторять нужно только после изменения схемы базы.

На этом Mac порт `3001` уже занят другим процессом, поэтому для проекта в `.env` используется
`API_PORT=3002`. Это нормально и на настройки Render не влияет.

Локальный прототип без Telegram открывается по адресу:

```text
http://localhost:5190/?demo=1
```

Demo-режим работает только в development и не проверяет настоящий Telegram-вход. Реальный токен
понадобится API при запуске приложения из Telegram после появления HTTPS URL.

Порт `5190` закреплён за Adaptive Wake Coach, потому что соседние порты заняты другими локальными проектами.
Vite использует `strictPort`, поэтому при новом конфликте сразу покажет ошибку вместо запуска на
неожиданном адресе.

Если порт PostgreSQL `5432` занят, в `.env` одновременно поменяйте:

```dotenv
POSTGRES_PORT=55432
DATABASE_URL=postgres://awc:awc@localhost:55432/awc
```

После изменения остановите процессы и снова выполните `pnpm db:start`, `pnpm db:migrate`,
`pnpm dev`.

## Шаг 3. Где взять хостинг

Для первого staging предлагается следующая связка:

- [Render](https://render.com/) — размещение Fastify API и статического React-приложения;
- [Neon](https://neon.com/) — управляемая PostgreSQL;
- GitHub — приватный репозиторий, из которого Render забирает код.

Render и Neon не являются обязательными навсегда, но подходят для первого пилота. Не нужно
покупать обычный файловый «хостинг сайтов»: нам нужен Node.js web service для API и PostgreSQL.

У проекта сейчас нет Git remote. Перед Render нужно создать приватный репозиторий на GitHub,
добавить его как `origin` и отправить ветку `dev`. Токены и `.env` в GitHub не отправляются.

Важное ограничение: бесплатный Render Web Service засыпает после периода без запросов, а Neon Free
при бездействии приостанавливает compute. Для разработки это нормально, но первый запуск после
паузы может быть медленнее. Требование «открывается быстро в любое время» проверяем на staging, а
для production используем always-on Render instance и конфигурацию Neon без scale-to-zero, если
измерения покажут заметную задержку.

## Шаг 4. Создать базу в Neon

Это действие выполняется на [console.neon.tech](https://console.neon.tech/).

1. Зарегистрируйтесь и нажмите `New Project`.
2. Назовите проект `adaptive-wake-coach-staging`.
3. Выберите регион как можно ближе к будущему региону Render.
4. Откройте проект и нажмите `Connect`.
5. Для первого staging выберите обычное direct connection, а не pooled connection: эта же строка
   будет использоваться миграциями.
6. Скопируйте всю строку, начинающуюся с `postgresql://` и содержащую `sslmode=require`.
7. Не вставляйте строку в Git, документацию, BotFather или React.

Эта строка и есть `DATABASE_URL`. Позже добавьте её в Render API Service → `Environment`.
В разделе Neon `Backup & Restore` проверьте доступное вашему тарифу окно восстановления. Для
будущего production создадим отдельный Neon project или отдельную строго изолированную базу.

## Шаг 5. Создать API Web Service в Render

Это действие выполняется на [dashboard.render.com](https://dashboard.render.com/).

1. Нажмите `New` → `Web Service`.
2. Подключите GitHub и выберите приватный репозиторий Adaptive Wake Coach.
3. В поле `Branch` выберите `dev`.
4. `Root Directory` оставьте пустым: сборка использует весь pnpm monorepo.
5. Выберите Node runtime.
6. В `Build Command` укажите:

   ```bash
   corepack enable && pnpm install --frozen-lockfile && pnpm db:migrate && pnpm build
   ```

7. В `Start Command` укажите:

   ```bash
   pnpm start:api
   ```

8. В `Health Check Path` укажите `/ready`. `/health` проверяет только живой процесс, а `/ready` —
   ещё и доступность PostgreSQL.
9. Для первых экспериментов можно проверить бесплатный instance, но для доступности без сна нужен
   платный always-on instance.
10. До первого deploy откройте слева `Environment` → `Add Environment Variable`.

Добавьте в **API Web Service**, по одной строке:

| Key                             | Value                                  |
| ------------------------------- | -------------------------------------- |
| `DATABASE_URL`                  | Строка подключения из Neon             |
| `TELEGRAM_BOT_TOKEN`            | Уже полученный токен BotFather         |
| `SESSION_SECRET`                | Новый результат `openssl rand -hex 32` |
| `TELEGRAM_AUTH_MAX_AGE_SECONDS` | `900`                                  |
| `TELEGRAM_WEB_APP_URL`          | `https://wake-coach-1.onrender.com/`   |
| `CRON_SECRET`                   | Новый результат `openssl rand -hex 32` |
| `DEEPSEEK_API_KEY`              | Ключ из кабинета DeepSeek              |
| `DEEPSEEK_BASE_URL`             | `https://api.deepseek.com`             |
| `DEEPSEEK_MODEL`                | `deepseek-v4-flash`                    |
| `DEEPSEEK_TIMEOUT_MS`           | `12000`                                |
| `READINESS_TIMEOUT_MS`          | `1500`                                 |
| `SHUTDOWN_TIMEOUT_MS`           | `9000`                                 |
| `AUTH_RATE_LIMIT_MAX`           | `30`                                   |
| `COACH_RATE_LIMIT_MAX`          | `10`                                   |

Render сам устанавливает `NODE_ENV=production` и `PORT`. Код API умеет читать Render `PORT`,
поэтому `API_PORT` на Render добавлять не нужно. DeepSeek-переменные добавляются только в API
Web Service, если нужен AI-наставник.

В Render «менеджер секретов» — это именно страница сервиса `Environment`. Можно нажать
`Add from .env`, но безопаснее добавить только перечисленные серверные переменные и не переносить
локальные `NODE_ENV`, `API_PORT` и `POSTGRES_PORT`.

После `Save, rebuild and deploy` откройте выданный адрес вида:

```text
https://wake-coach.onrender.com/health
```

Ответ должен быть `{"status":"ok"}`. Сохраните адрес API: он понадобится для rewrite frontend.

## Шаг 6. Создать React Static Site в Render

1. В Render нажмите `New` → `Static Site`.
2. Выберите тот же GitHub-репозиторий и ветку `dev`.
3. `Root Directory` оставьте пустым.
4. В `Build Command` укажите:

   ```bash
   corepack enable && pnpm install --frozen-lockfile && pnpm --filter @awc/web build
   ```

5. В `Publish Directory` укажите `apps/web/dist`.
6. Секретные environment variables этому Static Site не добавляйте.
7. После создания откройте `Redirects/Rewrites` и добавьте правила именно в таком порядке:

| Source    | Destination                              | Action    |
| --------- | ---------------------------------------- | --------- |
| `/api/*`  | `https://wake-coach.onrender.com/api/*`  | `Rewrite` |
| `/health` | `https://wake-coach.onrender.com/health` | `Rewrite` |
| `/ready`  | `https://wake-coach.onrender.com/ready`  | `Rewrite` |
| `/*`      | `/index.html`                            | `Rewrite` |

Первые три правила сохраняют один публичный origin для web и API; последнее обеспечивает работу
React-маршрутов. После настройки откройте `/health` и `/ready` уже на адресе Static Site и
убедитесь, что получены `{"status":"ok"}` и `{"status":"ready"}`. Затем пройдите Telegram
smoke-test и отдельно проверьте, что secure cookie сохраняется через Render rewrite. Если Render не
передаст cookie корректно, объединим web и API в один Web Service вместо ослабления защиты.

Для текущего staging используется `https://wake-coach-1.onrender.com/`. Публичная проверка
подтвердила React, health rewrite, Telegram-аутентификацию, secure cookie, bootstrap и безопасное
удаление временного тестового профиля.

Render выдаёт бесплатный HTTPS-адрес `*.onrender.com`; покупать домен для первого staging не
обязательно. Собственный домен понадобится ближе к production. Render автоматически обслуживает
HTTPS и позволяет позже добавить домен в `Settings` → `Custom Domains`.

## Шаг 6.1. Настроить бесплатный запуск через cron-job.org

cron-job.org будет только раз в пять минут обращаться к API. Доступ к Neon и токен Telegram ему не
нужны: они остаются в Render API Web Service. Для запроса используется отдельный `CRON_SECRET`.

### 1. Где создать секрет

В Terminal на Mac выполните один раз:

```bash
openssl rand -hex 32
```

Скопируйте результат. Затем откройте Render Dashboard → сервис `wake-coach` → `Environment` →
`Add Environment Variable`:

- Key: `CRON_SECRET`
- Value: только полученная строка, без `Bearer`, кавычек и пробелов

Нажмите `Save, rebuild and deploy`. Это новый отдельный секрет; второй токен Telegram получать не
нужно.

### 2. Что заполнить в cron-job.org

Откройте [cron-job.org](https://console.cron-job.org/) → `Cron задания` → `Создать cron задание`.

На вкладке **Общее**:

| Поле                      | Значение                                                          |
| ------------------------- | ----------------------------------------------------------------- |
| Заголовок                 | `Adaptive Wake Coach — отправка напоминаний`                      |
| URL                       | `https://wake-coach.onrender.com/internal/notifications/dispatch` |
| Включить задание          | Пока выключить; включить после успешного тестового запуска        |
| Сохранять ответы в архив  | Необязательно, для staging можно выключить                        |
| График                    | Каждые 5 минут                                                    |
| Crontab                   | `*/5 * * * *`                                                     |
| Уведомить после провалов  | Включить после 2 последовательных ошибок                          |
| Успех после прошлого сбоя | Включить                                                          |
| Отключение после ошибок   | Включить                                                          |

На вкладке **Расширенное**:

| Поле                     | Значение                                                           |
| ------------------------ | ------------------------------------------------------------------ |
| HTTP-аутентификация      | Выключена — это Basic Auth, она здесь не используется              |
| Заголовок 1, ключ        | `Authorization`                                                    |
| Заголовок 1, значение    | `Bearer ВАШ_CRON_SECRET` — слово Bearer, пробел и строка из Render |
| Заголовок 2, ключ        | `Content-Type`                                                     |
| Заголовок 2, значение    | `application/json`                                                 |
| Часовой пояс             | `Europe/Moscow` (на `*/5` результат от часового пояса не зависит)  |
| Метод запроса            | `POST`                                                             |
| Тело запроса             | `{}`                                                               |
| Тайм-аут                 | `30` секунд — cron-job.org не принимает значение больше 30         |
| Считать HTTP 3xx успехом | Выключено                                                          |

В Render хранится только сама строка секрета. В cron-job.org перед этой строкой обязательно стоит
`Bearer ` с одним пробелом. Пустой JSON-объект `{}` и `Content-Type: application/json` нужны,
чтобы cron-job.org не отправлял POST как неподдерживаемую HTML-форму. `TELEGRAM_BOT_TOKEN`,
`DATABASE_URL` и `SESSION_SECRET` в cron-job.org не добавляются.

### 3. Как проверить и включить

1. Дождитесь успешного deploy Render из ветки `dev`.
2. В cron-job.org оставьте задачу выключенной и нажмите `Тестовый запуск`.
3. Ожидаемый HTTP-код — `200`. Нормальный ответ без наступивших напоминаний:
   `wake` и `followUp` содержат нулевые счётчики, `maintenance` — число удалённых технических
   записей, а `durationMs` и `maxLagMs` — техническое время выполнения и максимальную задержку.
   Ответ не содержит Telegram ID, user/session ID, токены или ответы пользователя.
4. `401` означает, что значение после `Bearer ` не совпадает с `CRON_SECRET` в Render.
5. `415` означает, что отсутствует заголовок `Content-Type: application/json` или тело не равно
   `{}`.
6. `409` означает, что предыдущий запуск ещё выполняется. Это безопасная защита от пересечения;
   следующий запуск через пять минут продолжит работу.
7. `503` означает, что в Render API отсутствует `CRON_SECRET` или `TELEGRAM_WEB_APP_URL`; добавьте
   переменную и выполните новый deploy.
8. После ответа `200` включите задание и нажмите `Создать`/`Сохранить`.

Первый запрос к бесплатному Render после сна иногда может не уложиться в 30 секунд. Следующий
запуск через пять минут разбудит сервис; уведомление после двух последовательных ошибок поможет
отличить обычный холодный старт от реальной неисправности.

Это одно cron-задание обслуживает сразу два типа сообщений: ежедневное напоминание по сохранённому
времени и follow-up через 15 минут после завершения протокола. Второе cron-задание и второй токен
Telegram для этого не нужны. При каждом успешном запуске API также удаляет только технические
журналы доставки старше 90 дней; wake-сессии, оценки и ответы пользователя сохраняются.

## Какие переменные куда помещаются

| Имя переменной                  | Откуда взять значение                           | Куда добавить         |
| ------------------------------- | ----------------------------------------------- | --------------------- |
| `NODE_ENV`                      | Render устанавливает `production` автоматически | Не добавлять вручную  |
| `PORT`                          | Render добавляет автоматически                  | Не добавлять вручную  |
| `DATABASE_URL`                  | Скопировать из созданной на хостинге PostgreSQL | API и задача миграции |
| `TELEGRAM_BOT_TOKEN`            | Уже полученный токен BotFather                  | Только API-сервис     |
| `SESSION_SECRET`                | Новый результат `openssl rand -hex 32`          | Только API-сервис     |
| `TELEGRAM_AUTH_MAX_AGE_SECONDS` | Введите `900`                                   | Только API-сервис     |
| `TELEGRAM_WEB_APP_URL`          | `https://wake-coach-1.onrender.com/`            | Только API-сервис     |
| `CRON_SECRET`                   | Новый результат `openssl rand -hex 32`          | API и cron-job.org    |
| `DEEPSEEK_API_KEY`              | Ключ из кабинета DeepSeek                       | Только API-сервис     |
| `DEEPSEEK_BASE_URL`             | `https://api.deepseek.com`                      | Только API-сервис     |
| `DEEPSEEK_MODEL`                | `deepseek-v4-flash`                             | Только API-сервис     |
| `DEEPSEEK_TIMEOUT_MS`           | `12000`                                         | Только API-сервис     |

Статическому web-сервису секреты не передаются. В частности, нельзя создавать
`VITE_TELEGRAM_BOT_TOKEN`, `VITE_SESSION_SECRET` или `VITE_DEEPSEEK_API_KEY`: всё с префиксом
`VITE_` может попасть в браузер пользователя.

Локальный `.env` не загружается на хостинг автоматически. Значения нужно вручную перенести в
Render API Web Service → `Environment`. В cron-job.org добавляется только `CRON_SECRET` в виде
Bearer-заголовка. В GitHub, Render Static Site и BotFather секреты не добавляются.

## Шаг 7. Привязать HTTPS URL в BotFather

Это действие выполняется **в Telegram в чате с BotFather**, только после успешной проверки
`/health`.

1. Отправьте `/mybots`.
2. Выберите уже созданного бота.
3. Откройте `Bot Settings` → `Configure Mini App` → `Enable Mini App`.
4. Вставьте staging-адрес `https://wake-coach-1.onrender.com/`.
5. Настройте название, иконку и splash screen.
6. Откройте `Menu Button` либо отправьте `/setmenubutton`.
7. Введите текст кнопки `Открыть Wake Coach`.
8. Вставьте тот же URL `https://wake-coach-1.onrender.com/`.

После публикации приложения откройте в BotFather настройки политики конфиденциальности бота и
укажите:

```text
https://wake-coach-1.onrender.com/privacy
```

Не используйте для этого `/setprivacy`: эта команда изменяет режим получения групповых сообщений,
а не политику Mini App. До публичной беты на странице нужно заменить staging-описание разработчика
на полные реквизиты фактического оператора данных.

Ссылка для запуска Main Mini App:

```text
https://t.me/wake_coach_bot?startapp
```

Текущий staging-бот: [@wake_coach_bot](https://t.me/wake_coach_bot). Запуск Mini App и реальная
Telegram-аутентификация через него подтверждены 29 августа 2026 года.

Webhook и long polling пока не нужны: напоминания отправляет защищённый серверный обработчик через
Telegram Bot API, а cron-job.org только запускает его по времени.

## Шаг 8. Проверить реальный Telegram-вход

Откройте ссылку `https://t.me/<BOT_USERNAME>?startapp` внутри Telegram.

1. Проверить запуск на iOS, Android и Telegram Desktop.
2. Начать протокол и сохранить стартовую оценку.
3. Выполнить хотя бы одно задание.
4. Закрыть Mini App и открыть снова.
5. Убедиться, что приложение продолжает с подтверждённого шага.
6. Завершить протокол и сохранить follow-up.
7. Проверить статистику и источники расчёта.
8. Удалить тестовый профиль и убедиться, что новый вход создаёт чистый профиль.

Ошибка `telegram_auth_failed` обычно означает одно из следующего:

- приложение открыто как обычный сайт, а не из Telegram;
- URL привязан к одному боту, а в API установлен токен другого;
- перепутаны staging и production;
- часы сервера сильно расходятся;
- Telegram `initData` старше `TELEGRAM_AUTH_MAX_AGE_SECONDS`.

## Что делать с DeepSeek API key

AI-модуль уже работает на API-сервере и вызывается после накопления минимум трёх завершённых
сессий. Чтобы включить его на staging, откройте Render → сервис `wake-coach` (не Static Site) →
`Environment`, добавьте четыре `DEEPSEEK_*` переменные из таблицы выше и нажмите `Save, rebuild and
deploy`. В React, Render Static Site, Git, BotFather и cron-job.org этот ключ не передаётся.

Модели отправляются только агрегированные показатели без Telegram ID, UUID сессий, точного времени
и сырых ответов. Если DeepSeek недоступен или ключ отсутствует, обычная аналитика продолжает
работать, а интерфейс показывает безопасный детерминированный вывод без обращения к AI.

## Финальный чеклист staging

- [ ] токен созданного бота находится только в локальном `.env` и переменных API;
- [ ] `.env` игнорируется Git;
- [ ] staging PostgreSQL создана и не опубликована наружу;
- [ ] миграции применены;
- [ ] web и API доступны под одним HTTPS origin;
- [ ] `/health` возвращает `{"status":"ok"}`;
- [ ] `/ready` возвращает `{"status":"ready"}` и выбран как Render Health Check Path;
- [ ] Main Mini App и Menu Button настроены в BotFather;
- [ ] реальный сценарий пройден на iOS, Android и Desktop;
- [ ] backup PostgreSQL включён и проверен;
- [ ] опубликована политика конфиденциальности до закрытой беты.

## Переход на production-бота Prosnix

Для `@prosnix_bot` не нужны отдельные база данных и backend: на первом этапе он может использовать
тот же Render API и Neon PostgreSQL. Но один API-процесс проверяет подпись `initData` только токеном
одного бота, поэтому production-переключение выполняется заменой `TELEGRAM_BOT_TOKEN`, а не
добавлением второго токена.

Полная пошаговая инструкция, включая BotFather, webhook, откат и безопасное включение Stars,
находится в [`docs/prosnix-production.md`](./prosnix-production.md). До включения продаж оставьте
`TELEGRAM_STARS_MONTHLY_PRICE=0`: карточка Pro будет видна как анонс, но счёт создать будет
невозможно.

## Официальные источники Telegram

- [Создание и настройка ботов](https://core.telegram.org/bots/features#botfather)
- [Telegram Mini Apps](https://core.telegram.org/bots/webapps)
- [Main Mini Apps](https://core.telegram.org/api/bots/webapps#main-mini-apps)
- [Введение в Telegram Bots](https://core.telegram.org/bots)

## Официальные источники Render и Neon

- [Первое развёртывание на Render](https://render.com/docs/your-first-deploy)
- [Переменные и секреты Render](https://render.com/docs/configure-environment-variables)
- [Render Static Sites](https://render.com/docs/static-sites)
- [Redirects и Rewrites на Render](https://render.com/docs/redirects-rewrites)
- [Health checks на Render](https://render.com/docs/health-checks)
- [Подключение через Neon connection string](https://neon.com/docs/connect/connection-pooling)
- [Neon Scale to Zero](https://neon.com/docs/introduction/scale-to-zero)
