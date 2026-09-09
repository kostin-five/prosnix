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
