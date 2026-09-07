# Проверка 0.4 локально

1. Поднять отдельную disposable PostgreSQL и применить migrations.
2. Создать fixture пользователя и семь completed sessions.
3. Проверить `GET /api/v1/pro-interest`: `eligible: true`.
4. Отправить `interested` c `both`; повторить POST и убедиться, что запись одна.
5. Открыть stats в mobile Chromium: карточка сообщает об отсутствии оплаты и после ответа исчезает.
6. Проверить admin growth: есть только агрегированные `proInterest` counters.
7. Перед merge выполнить `pnpm verify:release:full` на отдельной test DB.
8. В отдельной PostgreSQL fixture создать legacy enum без `past_due`, применить repair SQL дважды и
   убедиться, что итоговый enum содержит значение ровно один раз.
9. В mobile E2E проверить успешный owner dashboard и отображение безопасного request ID при 500.
