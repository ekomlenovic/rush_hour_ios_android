/**
 * Runs one async task at a time: a call made while a task is running does nothing (issue 204).
 * The creator's "Test" and "Save" share one runner, so repeated taps launch a single check and
 * show a single result. `onBusyChange` drives the "checking" state of the buttons, and is reset
 * even when the task rejects.
 */
export function createExclusiveTask(onBusyChange: (busy: boolean) => void) {
  let running = false;
  return async <T>(task: () => Promise<T>, onResult: (result: T) => void): Promise<void> => {
    if (running) return;
    running = true;
    onBusyChange(true);
    try {
      onResult(await task());
    } finally {
      running = false;
      onBusyChange(false);
    }
  };
}
