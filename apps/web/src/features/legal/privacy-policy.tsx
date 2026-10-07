import { ProsnixWordmark } from "../brand/prosnix-brand.js";
import { LegalBack } from "./legal-back.js";

const UPDATED_AT = "26 сентября 2026 года";
const OPERATOR_NAME = import.meta.env.VITE_LEGAL_OPERATOR_NAME || "Владелец экземпляра Prosnix";
const OPERATOR_CONTACT = import.meta.env.VITE_LEGAL_CONTACT || "@prosnix_support";
const OPERATOR_CONTACT_URL = `https://t.me/${OPERATOR_CONTACT.replace(/^@/, "")}`;

export function PrivacyPolicy() {
  return (
    <main className="ps-legal min-h-screen px-5 py-10 text-foreground">
      <article className="ps-surface mx-auto max-w-2xl p-6 sm:p-8">
        <LegalBack />
        <ProsnixWordmark className="mb-6" />
        <h1 className="mt-2 text-3xl font-bold">Политика конфиденциальности</h1>
        <p className="mt-2 text-sm text-muted-foreground">Обновлено: {UPDATED_AT}</p>

        <section className="mt-8 space-y-3">
          <h2 className="text-lg font-bold">Кто управляет приложением</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Оператор: {OPERATOR_NAME}. Prosnix — независимое приложение, не связанное с Telegram.
            Связаться по вопросам данных можно через{" "}
            <a className="text-primary underline" href={OPERATOR_CONTACT_URL}>
              {OPERATOR_CONTACT}
            </a>
            .
          </p>
        </section>

        <section className="mt-7 space-y-3">
          <h2 className="text-lg font-bold">Необходимые cookie</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Cookie <code>awc_session</code> нужен только для защищённого входа и связи запросов с
            Telegram-профилем. Он хранится до 30 дней, недоступен JavaScript, передаётся только по
            HTTPS в production и имеет режим SameSite=Strict. Рекламных cookie и сторонних трекеров
            сейчас нет.
          </p>
        </section>

        <section className="mt-7 space-y-3">
          <h2 className="text-lg font-bold">Какие данные мы обрабатываем</h2>
          <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground">
            <li>Telegram user ID и язык интерфейса, переданные Telegram при запуске Mini App.</li>
            <li>Часовой пояс, оценки бодрости до и после протокола.</li>
            <li>
              Выбранный контекст пробуждения, доступное время и указанные пользователем ограничения
              заданий.
            </li>
            <li>Назначенные задания, факт выполнения, длительность и результат.</li>
            <li>Настроенная личная рутина и отмеченные выполненными пункты.</li>
            <li>Жизненная цель, только если пользователь явно сохранил её в настройках.</li>
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
          <p className="text-sm leading-relaxed text-muted-foreground">
            Камера и автоматическая проверка упражнений в текущей версии не используются. Если такая
            функция появится, она будет отдельной добровольной возможностью с ручной альтернативой и
            обновлённым описанием обработки данных до запуска.
          </p>
        </section>

        <section className="mt-7 space-y-3">
          <h2 className="text-lg font-bold">Зачем нужны данные</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Данные нужны, чтобы сохранять и восстанавливать wake-сессии, назначать контролируемые
            эксперименты, рассчитывать личную статистику и поддерживать безопасность сервиса. Мы не
            продаём персональные данные и не используем их для рекламного профилирования.
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Анкета возможностей только исключает неподходящие задания. Пункты личной рутины не
            входят в расчёт эффективности экспериментального протокола.
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Сохранённая жизненная цель показывается перед протоколом и передаётся Telegram только в
            тексте личного утреннего сообщения бота. Цель не используется для аналитики и не
            передаётся AI. Существующая цель на устройстве не переносится на сервер автоматически.
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
            Только после нажатия кнопки и при наличии трёх завершённых сессий сервер может передать
            DeepSeek агрегированные показатели: средний прирост бодрости, долю успешных подъёмов,
            эффекты протоколов и факторов, объём выборки и уровень уверенности. Telegram ID,
            идентификаторы сессий, точное время и сырые ответы не передаются. DeepSeek формулирует
            пояснение и следующий безопасный эксперимент, но не изменяет исходные наблюдения и
            математические показатели. Бесплатно создаётся не более одного нового пояснения в
            локальный календарный день; повторные открытия используют сохранённый результат. Если
            провайдер недоступен, приложение показывает детерминированное пояснение, рассчитанное
            нашим сервером без передачи данных внешней модели.
          </p>
        </section>

        <section className="mt-7 space-y-3">
          <h2 className="text-lg font-bold">Не медицинская услуга</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Prosnix помогает проводить личные эксперименты с пробуждением, но не ставит диагнозы и
            не заменяет врача. При устойчивых проблемах со сном следует обратиться к
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
          <a className="font-semibold text-primary underline" href={OPERATOR_CONTACT_URL}>
            Написать в поддержку: {OPERATOR_CONTACT}
          </a>
          <a className="text-muted-foreground underline" href="/terms">
            Пользовательское соглашение Prosnix
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
