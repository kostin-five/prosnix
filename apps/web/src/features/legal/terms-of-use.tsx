const UPDATED_AT = "31 августа 2026 года";
const OPERATOR_NAME = import.meta.env.VITE_LEGAL_OPERATOR_NAME || "Владелец сервиса Prosnix";
const OPERATOR_CONTACT = import.meta.env.VITE_LEGAL_CONTACT || "@prosnix_bot";

export function TermsOfUse() {
  return (
    <main className="min-h-screen bg-background px-5 py-10 text-foreground">
      <article className="mx-auto max-w-2xl rounded-3xl border border-border bg-card p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">Prosnix</p>
        <h1 className="mt-2 text-3xl font-bold">Пользовательское соглашение</h1>
        <p className="mt-2 text-sm text-muted-foreground">Обновлено: {UPDATED_AT}</p>

        <section className="mt-8 space-y-3 text-sm leading-relaxed text-muted-foreground">
          <h2 className="text-lg font-bold text-foreground">1. Сервис и оператор</h2>
          <p>
            Prosnix предоставляет инструменты личного наблюдения за пробуждением. Оператор:{" "}
            {OPERATOR_NAME}; контакт: {OPERATOR_CONTACT}. Telegram, Render, Neon и DeepSeek не
            являются оператором Prosnix.
          </p>
          <h2 className="text-lg font-bold text-foreground">2. Не медицинская услуга</h2>
          <p>
            Сервис не диагностирует и не лечит расстройства сна, не заменяет врача и не гарантирует
            пробуждение. Telegram-сообщение не является системным будильником и зависит от интернета
            и настроек уведомлений.
          </p>
          <h2 className="text-lg font-bold text-foreground">3. Правила использования</h2>
          <p>
            Пользователь предоставляет правдивые ответы для собственной статистики, не пытается
            обходить безопасность, нарушать работу сервиса или использовать его для причинения
            вреда. При выраженной сонливости, ухудшении здоровья или опасной деятельности следует
            прекратить эксперимент и обратиться к специалисту.
          </p>
          <h2 className="text-lg font-bold text-foreground">4. Доступность и изменения</h2>
          <p>
            На стадии тестирования сервис может обновляться и временно быть недоступен.
            Подтверждённые ответы сохраняются сервером, но абсолютная бесперебойность не обещается.
            Существенные изменения условий требуют принятия новой версии.
          </p>
          <h2 className="text-lg font-bold text-foreground">5. Pro-подписка</h2>
          <p>
            Пока продажи выключены, платные обязательства не возникают. После включения цифровые
            функции внутри Telegram оплачиваются только Telegram Stars. До покупки будут показаны
            цена, период, автопродление, порядок отмены, поддержки и возврата. Вопросы оплаты
            принимаются через команду /paysupport.
          </p>
          <h2 className="text-lg font-bold text-foreground">6. Данные и прекращение</h2>
          <p>
            Обработка данных описана в политике конфиденциальности. Пользователь может удалить
            профиль в настройках. Удаление профиля не отменяет уже активное автопродление Telegram;
            его необходимо отдельно отключить в Telegram или через поддержку.
          </p>
        </section>

        <div className="mt-8 flex gap-4 border-t border-border pt-6 text-sm">
          <a className="font-semibold text-primary underline" href="/privacy">
            Политика
          </a>
          <a className="font-semibold text-primary underline" href="https://t.me/prosnix_bot">
            @prosnix_bot
          </a>
        </div>
      </article>
    </main>
  );
}
