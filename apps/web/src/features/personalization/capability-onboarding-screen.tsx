import type { WakeProfile } from "../../shared/api/client.js";
import { ProsnixBrand } from "../brand/prosnix-brand.js";
import { CapabilityProfileCard } from "./capability-profile-card.js";

export function CapabilityOnboardingScreen({
  profile,
  saving,
  onSave,
  onCompleted,
}: {
  profile: WakeProfile;
  saving: boolean;
  onSave: (profile: Omit<WakeProfile, "revision">) => Promise<void>;
  onCompleted: () => void;
}) {
  return (
    <div className="flex min-h-0 min-w-0 max-w-full flex-1 flex-col overflow-x-hidden overflow-y-auto px-5 pb-8 pt-8">
      <ProsnixBrand />
      <p className="mt-8 text-xs font-semibold uppercase tracking-wider text-primary">
        Первая настройка
      </p>
      <h1 className="mt-2 text-3xl font-black leading-tight">Подберём безопасные задания</h1>
      <p className="mb-5 mt-3 text-sm leading-relaxed text-muted-foreground">
        Сначала укажи, что тебе подходит. Prosnix будет пробовать разные разрешённые комбинации и
        сравнивать твой результат — единого протокола для всех нет.
      </p>
      <CapabilityProfileCard
        profile={profile}
        saving={saving}
        onSave={onSave}
        onCompleted={onCompleted}
        initiallyEditing
        wizard
      />
    </div>
  );
}

export default CapabilityOnboardingScreen;
