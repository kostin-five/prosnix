const UPDATED_AT = "31 августа 2026 года";

export function PrivacyPolicy() {
  return (
    <main className="min-h-screen bg-background px-5 py-10 text-foreground">
      <article className="mx-auto max-w-2xl rounded-3xl border border-border bg-card p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">
          Adaptive Wake Coach
        </p>
        <h1 className="mt-2 text-3xl font-bold">Политика конфиденциальности</h1>
        <p className="mt-2 text-sm text-muted-foreground">Обновлено: {UPDATED_AT}</p>

        <section className="mt-8 space-y-3">
          <h2 className="text-lg font-bold">Кто управляет приложением</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Adaptive Wake Coach — независимое приложение, не связанное с Telegram. На этапе
            закрытого тестирования связаться с разработчиком можно через{" "}
            <a className="text-primary underline" href="https://t.me/wake_coach_bot">
              @wake_coach_bot
            </a>
            . Полные реквизиты оператора будут опубликованы до публичной беты.
          </p>
        </section>

        <section className="mt-7 space-y-3">
          <h2 className="text-lg font-bold">Какие данные мы обрабатываем</h2>
          <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground">
            <li>Telegram user ID и язык интерфейса, переданные Telegram при запуске Mini App.</li>
            <li>Часовой пояс, оценки бодрости до и после протокола.</li>
            <li>Назначенные задания, факт выполнения, длительность и результат.</li>
            <li>Ответ follow-up о том, удалось ли окончательно встать.</li>
            <li>Версии протоколов, время событий и источники расчёта аналитики.</li>
            <li>
              Технические сведения о запросах и ошибках. Render и сетевые провайдеры также могут
              обрабатывать IP-адрес и данные устройства для доставки и защиты сервиса.
            </li>
          </ul>
        </section>

        <section className="mt-7 space-y-3">
          <h2 className="text-lg font-bold">Чего мы не собираем</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Приложение не получает телефонную книгу, сообщения, номер телефона, точную геолокацию,
            данные HealthKit, фотографии или доступ к камере. Telegram launch data используется для
            проверки подписи и не сохраняется как история пользователя.
          </p>
        </section>

        <section className="mt-7 space-y-3">
          <h2 className="text-lg font-bold">Зачем нужны данные</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Данные нужны, чтобы сохранять и восстанавливать wake-сессии, назначать контролируемые
            эксперименты, рассчитывать личную статистику и поддерживать безопасность сервиса. Мы не
            продаём персональные данные и не используем их для рекламного профилирования.
          </p>
        </section>

        <section className="mt-7 space-y-3">
          <h2 className="text-lg font-bold">Где хранятся данные</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Приложение размещено в Render, а основная база PostgreSQL — в Neon. Telegram передаёт
            данные запуска согласно собственным условиям. Доступ к production-секретам имеет только
            серверная часть приложения.
          </p>
        </section>

        <section className="mt-7 space-y-3">
          <h2 className="text-lg font-bold">Удаление и срок хранения</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Активный профиль хранится, пока пользователь пользуется сервисом. Его можно удалить в
            разделе «Настройки» кнопкой «Удалить мой профиль». Пользователь, сессии, ответы,
            рассчитанный профиль и сохранённое AI-объяснение удаляются из активной базы. Технические
            журналы доставки Telegram-напоминаний автоматически удаляются через 90 дней. Резервные
            копии могут сохраняться до планового истечения отдельного срока хранения у
            инфраструктурного провайдера.
          </p>
        </section>

        <section className="mt-7 space-y-3">
          <h2 className="text-lg font-bold">DeepSeek и автоматические выводы</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            После трёх завершённых сессий сервер может передать DeepSeek агрегированные показатели:
            средний прирост бодрости, долю успешных подъёмов, эффекты протоколов и факторов, объём
            выборки и уровень уверенности. Telegram ID, идентификаторы сессий, точное время и сырые
            ответы не передаются. DeepSeek формулирует пояснение и следующий безопасный эксперимент,
            но не изменяет исходные наблюдения и математические показатели. Последнее пояснение
            кэшируется в нашей базе до изменения агрегатов или удаления профиля.
          </p>
        </section>

        <section className="mt-7 space-y-3">
          <h2 className="text-lg font-bold">Не медицинская услуга</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Adaptive Wake Coach помогает проводить личные эксперименты с пробуждением, но не ставит
            диагнозы и не заменяет врача. При устойчивых проблемах со сном следует обратиться к
            квалифицированному специалисту.
          </p>
        </section>

        <section className="mt-7 space-y-3">
          <h2 className="text-lg font-bold">Изменения политики</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            При существенном изменении состава данных или подключении новых обработчиков дата и
            содержание этой страницы будут обновлены до включения соответствующей функции.
          </p>
        </section>

        <div className="mt-8 flex flex-col gap-3 border-t border-border pt-6 text-sm">
          <a className="font-semibold text-primary underline" href="https://t.me/wake_coach_bot">
            Открыть @wake_coach_bot
          </a>
          <a
            className="text-muted-foreground underline"
            href="https://telegram.org/privacy-tpa"
            target="_blank"
            rel="noreferrer"
          >
            Стандартная политика Telegram для ботов и Mini Apps
          </a>
        </div>
      </article>
    </main>
  );
}
