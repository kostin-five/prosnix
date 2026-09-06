import { ExternalLink, LockKeyhole, Settings2, Sparkles } from "lucide-react";

import { DeleteProfile } from "../profile/delete-profile.js";
import type { WakeSchedule } from "../schedule/schedule-api.js";
import { WakeScheduleCard } from "../schedule/wake-schedule-card.js";
import { ProCard } from "../billing/pro-card.js";
import { CapabilityProfileCard } from "../personalization/capability-profile-card.js";
import { WakeRoutineCard } from "../personalization/wake-routine-card.js";
import type { WakeProfile, WakeRoutine } from "../../shared/api/client.js";
import { ProductBetaBadge } from "../brand/prosnix-brand.js";

export function SettingsScreen({
  alarmTime,
  schedule,
  saving,
  demo,
  onScheduleSave,
  wakeProfile,
  wakeRoutine,
  personalizationSaving,
  onProfileSave,
  onRoutineSave,
}: {
  alarmTime: string;
  schedule: WakeSchedule | null;
  saving: boolean;
  demo: boolean;
  onScheduleSave: (input: {
    localTime: string;
    timezone: string;
    enabled: boolean;
  }) => Promise<void>;
  wakeProfile: WakeProfile;
  wakeRoutine: WakeRoutine;
  personalizationSaving: boolean;
  onProfileSave: (profile: Omit<WakeProfile, "revision">) => Promise<void>;
  onRoutineSave: (routine: Omit<WakeRoutine, "revision">) => Promise<void>;
}) {
  return (
    <div className="flex flex-1 flex-col overflow-y-auto px-5 pb-28 pt-14">
      <div className="mb-6 flex items-center gap-3">
        <Settings2 className="h-6 w-6 text-primary" />
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">Настройки</h1>
            <ProductBetaBadge />
          </div>
          <p className="text-sm text-muted-foreground">Напоминания и данные профиля</p>
        </div>
      </div>

      <WakeScheduleCard
        schedule={schedule}
        defaultTime={alarmTime}
        saving={saving}
        onSave={onScheduleSave}
      />

      <CapabilityProfileCard
        profile={wakeProfile}
        saving={personalizationSaving}
        onSave={onProfileSave}
      />
      <WakeRoutineCard
        routine={wakeRoutine}
        saving={personalizationSaving}
        onSave={onRoutineSave}
      />

      {!demo && <ProCard />}

      <section className="mb-4 rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-accent" />
          <p className="text-sm font-semibold">Персональный отчёт Beta</p>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          Он по твоему запросу ищет устойчивость результата, сравнивает доступные протоколы и
          предлагает следующий эксперимент. Отчёт не меняет оценки и не управляет протоколом.
          Бесплатно создаётся один новый отчёт в день; повторное открытие показывает сохранённый.
        </p>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <LockKeyhole className="h-4 w-4 text-green-400" />
          <p className="text-sm font-semibold">Конфиденциальность</p>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          Здесь описано, какие данные сохраняются, зачем они нужны и как удалить профиль.
        </p>
        <a
          href="/privacy"
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-primary"
        >
          Открыть политику <ExternalLink className="h-3.5 w-3.5" />
        </a>
        <a
          href="/terms"
          className="ml-4 mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-primary"
        >
          Соглашение <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </section>

      {!demo && <DeleteProfile />}
    </div>
  );
}
