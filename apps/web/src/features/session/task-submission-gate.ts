export class TaskSubmissionGate {
  private locked = false;

  acquire(expectedTaskId: string | undefined, submittedTaskId: string): boolean {
    if (this.locked || expectedTaskId === undefined || expectedTaskId !== submittedTaskId) {
      return false;
    }
    this.locked = true;
    return true;
  }

  reset(): void {
    this.locked = false;
  }
}

export function taskSubmissionConflictMessage(
  code: string,
  submittedStepIndex: number | undefined,
  canonicalStepIndex: number,
): string {
  if (code === "invalid_transition" && submittedStepIndex === canonicalStepIndex) {
    return "Результат шага не принят. Задание перезапущено — выполни его полностью.";
  }
  return "Состояние сессии синхронизировано. Продолжи с текущего шага.";
}
