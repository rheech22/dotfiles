import { Key, matchesKey, ProcessTerminal, TUI, type Terminal } from "@earendil-works/pi-tui";
import type { DotsApplication } from "./application.js";
import { TuiController, type Workspace } from "./tui-controller.js";
import { DashboardComponent } from "./tui-renderer.js";
import { confirmationFits } from "./tui-layout.js";

export interface RunTuiOptions {
  readonly terminal?: Terminal;
}

export class TuiExitLatch {
  #failed = false;
  #controllerError = false;
  #signalCode: number | undefined;
  #signaled = false;

  get code(): number {
    return this.#signalCode ?? (this.#failed || this.#controllerError ? 1 : 0);
  }

  observe(state: TuiController["state"]): void {
    this.#controllerError = state.mode === "error" || state.mode === "setup-error";
    if (state.mode === "result" && (state.result as { readonly success?: boolean }).success === false) this.fail();
    if (state.mode === "setup-result" && (state.result.status === "partial" || state.result.status === "failed")) this.fail();
  }

  fail(): void {
    if (!this.#signaled) this.#failed = true;
  }

  signal(code: number): void {
    this.#signaled = true;
    this.#signalCode = code;
  }
}

function inputKey(data: string): string | undefined {
  for (const key of ["up", "down", "left", "right", "escape", "enter", "space"] as const) {
    if (matchesKey(data, Key[key])) return key;
  }
  for (const key of ["1", "2", "3", "a", "d", "j", "k", "l", "n", "p", "q", "r", "s", "y", "?"] as const) {
    if (matchesKey(data, key)) return key;
  }
  if (matchesKey(data, Key.ctrl("c"))) return "q";
  return undefined;
}

export async function runTui(
  app: DotsApplication,
  initialRoute: Workspace = "overview",
  options: RunTuiOptions = {},
): Promise<number> {
  if (!options.terminal && (!process.stdin.isTTY || !process.stdout.isTTY)) throw new Error("TUI requires an interactive terminal");

  const terminal = options.terminal ?? new ProcessTerminal();
  const tui = new TUI(terminal, false);
  let stopped = false;
  const exitLatch = new TuiExitLatch();
  let resolveExit: (() => void) | undefined;
  const exited = new Promise<void>((resolve) => { resolveExit = resolve; });
  const tasks = new Set<Promise<void>>();
  let activeMutation: Promise<void> | undefined;
  const track = (task: Promise<void>, mutation = false): Promise<void> => {
    tasks.add(task);
    const tracked = task.catch(() => exitLatch.fail()).finally(() => {
      tasks.delete(task);
      if (activeMutation === tracked) activeMutation = undefined;
    });
    if (mutation) activeMutation = tracked;
    return tracked;
  };
  const stop = (): void => {
    if (stopped) return;
    stopped = true;
    resolveExit?.();
  };
  let controller: TuiController;
  let progressActive = false;
  let setupTask: Promise<void> | undefined;
  const component = new DashboardComponent(
    controller = new TuiController({
      app,
      initialRoute,
      canConfirm: () => confirmationFits(controller.state, terminal.columns, terminal.rows, controller.home),
      viewport: () => ({ columns: terminal.columns, rows: terminal.rows }),
      onExit: stop,
      onMutationOutcome: (success) => { if (!success) exitLatch.fail(); },
      onSetupTask: (task) => { setupTask = track(task); },
      onChange: () => {
        const active = controller.state.mode === "mutating" || controller.state.mode === "exit-pending" || controller.state.mode === "setup-running" || (controller.state.mode === "setup-exit-pending" && controller.state.activity === "running");
        const setupMutation = controller.state.mode === "setup-running" || (controller.state.mode === "setup-exit-pending" && controller.state.activity === "running");
        if (setupMutation && setupTask) activeMutation = setupTask;
        else if (activeMutation === setupTask) activeMutation = undefined;
        exitLatch.observe(controller.state);
        if (active !== progressActive) {
          progressActive = active;
          terminal.setProgress(active);
        }
        tui.requestRender();
      },
    }),
    () => ({ rows: terminal.rows }),
  );
  tui.addChild(component);
  tui.setFocus(component);
  const removeInput = tui.addInputListener((data) => {
    const key = inputKey(data);
    if (!key) return undefined;
    const mutation = key === "y" && controller.state.mode === "confirming";
    track(controller.input(key), mutation);
    return { consume: true };
  });

  const signals: ReadonlyArray<readonly [NodeJS.Signals, number]> = [["SIGINT", 130], ["SIGTERM", 143], ["SIGHUP", 129]];
  const handlers = signals.map(([signal, code]) => {
    const handler = (): void => {
      exitLatch.signal(code);
      track(controller.input("q"));
    };
    process.on(signal, handler);
    return [signal, handler] as const;
  });

  try {
    terminal.setTitle("dots");
    tui.start();
    track(controller.start());
    await exited;
    if (activeMutation) await activeMutation;
  } finally {
    removeInput();
    for (const [signal, handler] of handlers) process.removeListener(signal, handler);
    try {
      terminal.setProgress(false);
      terminal.setTitle("");
    } finally {
      tui.stop();
    }
  }
  return exitLatch.code;
}
