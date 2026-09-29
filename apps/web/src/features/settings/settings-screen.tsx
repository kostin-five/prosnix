import { useEffect, useState } from "react";
import {
  Activity,
  Bell,
  ChevronLeft,
  ChevronRight,
  Crown,
  FileText,
  Headphones,
  Flag,
  ListChecks,
  LockKeyhole,
  Trash2,
} from "lucide-react";

import { DeleteProfile } from "../profile/delete-profile.js";
import type { WakeSchedule } from "../schedule/schedule-api.js";
import { WakeScheduleCard } from "../schedule/wake-schedule-card.js";
import { ProCard } from "../billing/pro-card.js";
import { CapabilityProfileCard } from "../personalization/capability-profile-card.js";
import { MorningGoalCard } from "../personalization/morning-goal-card.js";
import { WakeRoutineCard } from "../personalization/wake-routine-card.js";
import type { WakeProfile, WakeRoutine } from "../../shared/api/client.js";
import { resetHandsFreeGuidance } from "../tasks/hands-free-audio.js";

export default function SettingsScreen({
  initialSection = null,
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
  localStorageScope,
  goalCalibrationEnabled,
}: {
  initialSection?: "capabilities" | "goal" | null;
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
  localStorageScope: string;
  goalCalibrationEnabled: boolean;
}) {
  const [section, setSection] = useState<
    "schedule" | "capabilities" | "goal" | "routine" | "audio" | "pro" | "privacy" | "delete" | null
  >(initialSection);
  const [guidanceReset, setGuidanceReset] = useState(false);
  useEffect(() => setSection(initialSection), [initialSection]);

  const row = (title: string, description: string, icon: React.ReactNode, onClick: () => void) => (
    <button type="button" className="ps-settings-row" onClick={onClick}>
      <span className="ps-settings-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{title}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span>
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
    </button>
  );

  return (
    <div className="ps-settings flex flex-1 flex-col overflow-y-auto px-5 pb-28 pt-8">
      {section && (
        <button
          type="button"
          onClick={() => setSection(null)}
          className="mb-5 flex min-h-11 items-center gap-2 self-start text-sm text-amber-300"
        >
          <ChevronLeft className="h-5 w-5" /> Настройки
        </button>
      )}
      {!section ? (
        <>
          <span className="ps-wordmark" aria-label="Prosnix">
            Prosni<span>x</span>
          </span>
          <h1 className="ps-flow-title mt-6">Настройки</h1>
          <p className="mt-2 text-sm text-muted-foreground">Сделай приложение удобным для себя</p>

          <div className="ps-surface mt-7 overflow-hidden">
            {row(
              "Напоминания",
              schedule?.enabled ? `Каждый день · ${schedule.localTime}` : "Сообщения в Telegram",
              <Bell className="h-5 w-5" />,
              () => setSection("schedule"),
            )}
            {row(
              "Возможности",
              "Движение и доступные задания",
              <Activity className="h-5 w-5" />,
              () => setSection("capabilities"),
            )}
            {goalCalibrationEnabled &&
              row(
                "Цель в жизни",
                "Ради чего хочется начать день",
                <Flag className="h-5 w-5" />,
                () => setSection("goal"),
              )}
            {row(
              "Личный распорядок",
              wakeRoutine.enabled
                ? `${wakeRoutine.items.length} пунктов после пробуждения`
                : "Шаги после пробуждения",
              <ListChecks className="h-5 w-5" />,
              () => setSection("routine"),
            )}
            {row(
              "Без телефона",
              "Голосовые подсказки к заданиям",
              <Headphones className="h-5 w-5" />,
              () => setSection("audio"),
            )}
            {!demo &&
              row("Pro", "Узнать о возможностях", <Crown className="h-5 w-5" />, () =>
                setSection("pro"),
              )}
          </div>

          <div className="ps-surface mt-4 overflow-hidden">
            {row(
              "Конфиденциальность",
              "Данные и документы",
              <LockKeyhole className="h-5 w-5" />,
              () => setSection("privacy"),
            )}
          </div>
          <button
            type="button"
            onClick={() => setSection("delete")}
            className="ps-surface mt-4 flex min-h-14 items-center gap-3 px-4 text-left text-red-400"
          >
            <Trash2 className="h-5 w-5" /> Удалить профиль
            <ChevronRight className="ml-auto h-5 w-5" />
          </button>
        </>
      ) : (
        <div className="ps-settings-detail">
          <h1 className="ps-flow-title mb-2">
            {
              {
                schedule: "Напоминания",
                capabilities: "Возможности",
                goal: "Цель в жизни",
                routine: "Личный распорядок",
                audio: "Без телефона",
                pro: "Pro",
                privacy: "Документы",
                delete: "Удаление профиля",
              }[section]
            }
          </h1>
          <p className="mb-6 text-sm text-muted-foreground">
            {
              {
                schedule: "Сообщения в твоём личном чате Telegram",
                capabilities: "Задания подбираются с учётом твоих ответов",
                goal: "Что вдохновляет тебя начинать новый день?",
                routine: "Необязательные шаги после пробуждения",
                audio: "Подробные инструкции звучат при первой встрече с заданием",
                pro: "Возможности Prosnix",
                privacy: "Правила использования и обработки данных",
                delete: "Управление личными данными",
              }[section]
            }
          </p>
          {section === "schedule" && (
            <WakeScheduleCard
              schedule={schedule}
              defaultTime={alarmTime}
              saving={saving}
              onSave={onScheduleSave}
            />
          )}
          {section === "capabilities" && (
            <CapabilityProfileCard
              profile={wakeProfile}
              saving={personalizationSaving}
              onSave={onProfileSave}
            />
          )}
          {section === "goal" && goalCalibrationEnabled && (
            <MorningGoalCard storageScope={localStorageScope} />
          )}
          {section === "routine" && (
            <WakeRoutineCard
              routine={wakeRoutine}
              saving={personalizationSaving}
              onSave={onRoutineSave}
            />
          )}
          {section === "audio" && (
            <div className="ps-surface p-4">
              <p className="text-sm leading-relaxed text-muted-foreground">
                Верни подробную озвучку для всех заданий. Следующий раз подсказка снова объяснит,
                как выполнять каждое действие.
              </p>
              <button
                type="button"
                onClick={() => {
                  resetHandsFreeGuidance(localStorageScope);
                  setGuidanceReset(true);
                }}
                className="ps-primary-button mt-4 w-full"
              >
                Повторить подробные подсказки
              </button>
              {guidanceReset && (
                <p className="mt-2 text-sm text-primary">Подсказки восстановлены</p>
              )}
            </div>
          )}
          {section === "pro" && !demo && <ProCard />}
          {section === "privacy" && (
            <div className="ps-surface overflow-hidden">
              <a href="/privacy" className="ps-settings-row">
                <span className="ps-settings-icon">
                  <LockKeyhole className="h-5 w-5" />
                </span>
                <span className="flex-1 font-semibold">Политика конфиденциальности</span>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </a>
              <a href="/terms" className="ps-settings-row">
                <span className="ps-settings-icon">
                  <FileText className="h-5 w-5" />
                </span>
                <span className="flex-1 font-semibold">Пользовательское соглашение</span>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </a>
            </div>
          )}
          {section === "delete" &&
            (demo ? (
              <p className="ps-surface p-4 text-sm text-muted-foreground">
                В деморежиме профиль не создаётся. Удалить свои данные можно здесь после входа через
                Telegram.
              </p>
            ) : (
              <DeleteProfile localStorageScope={localStorageScope} />
            ))}
        </div>
      )}
    </div>
  );
}
