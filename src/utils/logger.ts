import pino from "pino";

// missionlog?

export const logger = pino({
  level: "debug",
  // https://github.com/pinojs/pino/blob/HEAD/docs/browser.md
  browser: {},
});
