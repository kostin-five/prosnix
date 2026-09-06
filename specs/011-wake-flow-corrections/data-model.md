# Модель данных

Migration не требуется.

- **profileProgress**: число завершённых с baseline/post-rating, для готовности общего профиля.
- **currentProtocolLeader**: protocol effect с максимальным средним, включая `n=1`, с confidence/evidence count.
- **previousAssignmentSignature**: упорядоченный список task ID последнего завершённого назначения; только server-side для следующего выбора.

Source observations не изменяются. Лидер с `insufficient` не является причинным утверждением.
