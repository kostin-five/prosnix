## ADDED Requirements

### Requirement: Privacy-safe logs

Сервер SHALL исключать тела, заголовки, query-параметры и свободный текст ошибок из автоматических журналов.

#### Scenario: Database failure

- **WHEN** ошибка БД содержит параметры пользователя
- **THEN** журнал содержит только безопасный идентификатор ошибки и запроса.

### Requirement: Production configuration

Production MUST отклонять отсутствующую БД и примерные секреты до начала обслуживания запросов.

#### Scenario: Example credentials

- **WHEN** production запускается с плейсхолдером SESSION_SECRET
- **THEN** запуск завершается ошибкой без печати значения.

### Requirement: Isolated portfolio demo

Отдельная demo-сборка SHALL использовать только синтетические данные и блокировать обращения к API.

#### Scenario: Telegram identity in demo

- **WHEN** demo открывается с Telegram initData
- **THEN** данные Telegram не используются и запрос аутентификации не отправляется.

### Requirement: Explicit integration database

Интеграционный запуск MUST завершаться ошибкой без явной локальной тестовой БД.

#### Scenario: Missing database

- **WHEN** DATABASE_URL отсутствует
- **THEN** команда не сообщает об успешной проверке.
