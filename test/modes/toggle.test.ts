import { describe, expect, mock, test } from "bun:test";
import { buildOpenEditorArgv, runToggleMode, type ToggleModeOptions } from "../../src/modes/toggle";

function createOptions(overrides: Partial<ToggleModeOptions> = {}): ToggleModeOptions {
  return {
    mux: "herdr",
    targetPane: "w1:p1",
    paneRows: 12,
    alwaysCopy: true,
    editor: "nvim",
    env: ["NVIM_NOTTYFAST=1"],
    quiet: true,
    verbose: false,
    invocation: {
      execPath: "/usr/local/bin/node",
      scriptPath: "/repo with spaces/dist/index.js",
    },
    ...overrides,
  };
}

describe("toggle mode", () => {
  test("builds an open command using the current editprompt entrypoint", () => {
    expect(buildOpenEditorArgv(createOptions())).toEqual([
      "/usr/local/bin/node",
      "/repo with spaces/dist/index.js",
      "open",
      "--mux",
      "herdr",
      "--target-pane",
      "w1:p1",
      "--editor",
      "nvim",
      "--always-copy",
      "--env",
      "NVIM_NOTTYFAST=1",
      "--quiet",
    ]);
  });

  test("focuses an existing editor without creating a split", async () => {
    const resumeEditorPane = mock(async () => true);
    const splitEditorPane = mock(async () => "w1:p2");
    const runCommandInPane = mock(async () => {});
    const closePane = mock(async () => {});

    await runToggleMode(createOptions(), {
      resumeEditorPane,
      splitEditorPane,
      runCommandInPane,
      closePane,
    });

    expect(resumeEditorPane).toHaveBeenCalledWith("w1:p1");
    expect(splitEditorPane).not.toHaveBeenCalled();
    expect(runCommandInPane).not.toHaveBeenCalled();
  });

  test("creates a bottom split and runs open when no editor exists", async () => {
    const originalCwd = process.env.HERDR_ACTIVE_PANE_CWD;
    const originalNodeWarnings = process.env.NODE_NO_WARNINGS;
    process.env.HERDR_ACTIVE_PANE_CWD = "/repo";
    process.env.NODE_NO_WARNINGS = "1";

    const resumeEditorPane = mock(async () => false);
    const splitEditorPane = mock(async () => "w1:p2");
    const runCommandInPane = mock(async () => {});
    const closePane = mock(async () => {});

    try {
      const options = createOptions();
      await runToggleMode(options, {
        resumeEditorPane,
        splitEditorPane,
        runCommandInPane,
        closePane,
      });

      expect(splitEditorPane).toHaveBeenCalledWith("w1:p1", 12, "/repo", {
        NODE_NO_WARNINGS: "1",
      });
      expect(runCommandInPane).toHaveBeenCalledWith("w1:p2", buildOpenEditorArgv(options));
      expect(closePane).not.toHaveBeenCalled();
    } finally {
      if (originalCwd === undefined) {
        delete process.env.HERDR_ACTIVE_PANE_CWD;
      } else {
        process.env.HERDR_ACTIVE_PANE_CWD = originalCwd;
      }
      if (originalNodeWarnings === undefined) {
        delete process.env.NODE_NO_WARNINGS;
      } else {
        process.env.NODE_NO_WARNINGS = originalNodeWarnings;
      }
    }
  });

  test("closes a newly-created pane when command launch fails", async () => {
    const launchError = new Error("launch failed");
    const closePane = mock(async () => {});

    let thrown: unknown;
    try {
      await runToggleMode(createOptions(), {
        resumeEditorPane: mock(async () => false),
        splitEditorPane: mock(async () => "w1:p2"),
        runCommandInPane: mock(async () => {
          throw launchError;
        }),
        closePane,
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBe(launchError);
    expect(closePane).toHaveBeenCalledWith("w1:p2");
  });

  test("rejects unsupported multiplexers and invalid row counts", async () => {
    let muxError: unknown;
    let rowsError: unknown;
    try {
      await runToggleMode(createOptions({ mux: "tmux" }));
    } catch (error) {
      muxError = error;
    }
    try {
      await runToggleMode(createOptions({ paneRows: 0 }));
    } catch (error) {
      rowsError = error;
    }

    expect(muxError).toBeInstanceOf(Error);
    expect((muxError as Error).message).toBe(
      "toggle currently supports only the Herdr multiplexer",
    );
    expect(rowsError).toBeInstanceOf(Error);
    expect((rowsError as Error).message).toBe("--pane-rows must be a positive integer");
  });
});
