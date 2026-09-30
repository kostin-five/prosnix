# Tasks

## 1. Telegram-сообщение

- [x] 1.1 Передать ID follow-up сессии в notification gateway и показывать три callback-кнопки только при доступном защищённом webhook; проверить unit-тестом текст, outcome и fallback Mini App.
- [x] 1.2 Добавить ответ на Telegram callback и удаление клавиатуры после успеха; проверить unit-тестом сетевую ошибку без раскрытия payload.
- [x] 1.3 Добавить один уместный эмодзи в текст follow-up и сохранить прежний fallback; проверить оба варианта gateway-тестом.

## 2. Серверное принятие

- [x] 2.1 Проверять отправленную delivery-запись по сессии, пользователю и message ID; проверить repository integration на отдельной PostgreSQL.
- [x] 2.2 Пропустить callback через существующий защищённый webhook и `SessionService` с проверкой Telegram identity, ownership и идемпотентности; проверить contract тестами чужой ID, повтор и прежние billing-команды.

## 3. Выпускной контроль

- [ ] 3.1 Обновить API/architecture/testing/release документы, roadmap и handoff; проверить `openspec validate --strict` и `pnpm verify:release:full` на disposable PostgreSQL.
