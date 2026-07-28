import type { SendConfig } from "../types/send";
import { resolveMux } from "./mux";

export function readSendConfig(): SendConfig {
  const mux = resolveMux();
  const alwaysCopy = process.env.EDITPROMPT_ALWAYS_COPY === "1";

  const delayValue = process.env.EDITPROMPT_SEND_KEY_DELAY;
  const parsedDelay = delayValue ? Number.parseInt(delayValue, 10) : Number.NaN;
  const sendKeyDelay = Number.isNaN(parsedDelay) ? 1000 : parsedDelay;

  return {
    mux,
    alwaysCopy,
    sendKeyDelay,
  };
}
