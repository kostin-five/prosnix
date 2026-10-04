import { ProsnixWordmark } from "../brand/prosnix-brand.js";
import type { WakeProfile } from "../../shared/api/client.js";
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
    <div className="ps-flow flex min-h-0 min-w-0 max-w-full flex-1 flex-col overflow-x-hidden overflow-y-auto px-5 pb-8 pt-8">
      <ProsnixWordmark className="" />
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
