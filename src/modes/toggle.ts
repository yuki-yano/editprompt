import { getLogger } from "@logtape/logtape";
import { define } from "gunshi";
import * as herdr from "../modules/herdr";
import { setupLogger } from "../modules/logger";
import type { MuxType } from "../utils/mux";
import {
  ARG_ALWAYS_COPY,
  ARG_EDITOR,
  ARG_ENV,
  ARG_LOG_FILE,
  ARG_MUX,
  ARG_QUIET,
  ARG_TARGET_PANE_SINGLE,
  ARG_VERBOSE,
  validateMux,
  validateTargetPane,
} from "./args";

const logger = getLogger(["editprompt", "toggle"]);
const DEFAULT_EDITOR_PANE_ROWS = 12;

interface EditpromptInvocation {
  execPath: string;
  scriptPath: string;
}

export interface ToggleModeOptions {
  mux: MuxType;
  targetPane: string;
  paneRows: number;
  alwaysCopy: boolean;
  editor?: string;
  env?: string[];
  logFile?: string;
  quiet: boolean;
  verbose: boolean;
  invocation?: EditpromptInvocation;
}

type ToggleHerdrApi = Pick<
  typeof herdr,
  "closePane" | "resumeEditorPane" | "runCommandInPane" | "splitEditorPane"
>;

export function buildOpenEditorArgv(options: ToggleModeOptions): string[] {
  const invocation = options.invocation ?? {
    execPath: process.execPath,
    scriptPath: process.argv[1],
  };
  if (!invocation.scriptPath) {
    throw new Error("Cannot determine the editprompt entrypoint");
  }

  const argv = [
    invocation.execPath,
    invocation.scriptPath,
    "open",
    "--mux",
    options.mux,
    "--target-pane",
    options.targetPane,
  ];
  if (options.editor) {
    argv.push("--editor", options.editor);
  }
  if (options.alwaysCopy) {
    argv.push("--always-copy");
  }
  for (const env of options.env ?? []) {
    argv.push("--env", env);
  }
  if (options.logFile) {
    argv.push("--log-file", options.logFile);
  }
  if (options.quiet) {
    argv.push("--quiet");
  }
  if (options.verbose) {
    argv.push("--verbose");
  }
  return argv;
}

export async function runToggleMode(
  options: ToggleModeOptions,
  herdrApi: ToggleHerdrApi = herdr,
): Promise<void> {
  if (options.mux !== "herdr") {
    throw new Error("toggle currently supports only the Herdr multiplexer");
  }
  if (!Number.isInteger(options.paneRows) || options.paneRows <= 0) {
    throw new Error("--pane-rows must be a positive integer");
  }

  if (await herdrApi.resumeEditorPane(options.targetPane)) {
    return;
  }

  // The split pane starts with a fresh shell environment, so Node runtime
  // warnings would reappear in the editor pane unless this is carried over.
  const launchEnv: Record<string, string> = {};
  if (process.env.NODE_NO_WARNINGS !== undefined) {
    launchEnv.NODE_NO_WARNINGS = process.env.NODE_NO_WARNINGS;
  }

  const editorPaneId = await herdrApi.splitEditorPane(
    options.targetPane,
    options.paneRows,
    process.env.HERDR_ACTIVE_PANE_CWD,
    launchEnv,
  );
  try {
    await herdrApi.runCommandInPane(editorPaneId, buildOpenEditorArgv(options));
  } catch (error) {
    try {
      await herdrApi.closePane(editorPaneId);
    } catch (closeError) {
      logger.warn("Failed to close editor pane after launch failure: {error}", {
        error: closeError,
      });
    }
    throw error;
  }
}

export const toggleCommand = define({
  name: "toggle",
  description: "Open or focus an editor pane",
  args: {
    mux: ARG_MUX,
    "target-pane": ARG_TARGET_PANE_SINGLE,
    "pane-rows": {
      description: "Desired rows for the Herdr editor pane",
      type: "number",
      default: DEFAULT_EDITOR_PANE_ROWS,
    },
    editor: ARG_EDITOR,
    "always-copy": ARG_ALWAYS_COPY,
    env: ARG_ENV,
    "log-file": ARG_LOG_FILE,
    quiet: ARG_QUIET,
    verbose: ARG_VERBOSE,
  },
  async run(ctx) {
    const logFile = ctx.values["log-file"] as string | undefined;
    const quiet = Boolean(ctx.values.quiet);
    const verbose = Boolean(ctx.values.verbose);
    setupLogger({ quiet, verbose, logFile });

    const targetPane = validateTargetPane(ctx.values["target-pane"], "toggle");
    const mux = validateMux(ctx.values.mux);
    try {
      await runToggleMode({
        mux,
        targetPane,
        paneRows: Number(ctx.values["pane-rows"]),
        alwaysCopy: Boolean(ctx.values["always-copy"]),
        editor: ctx.values.editor as string | undefined,
        env: ctx.values.env as string[] | undefined,
        logFile,
        quiet,
        verbose,
      });
    } catch (error) {
      logger.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  },
});
