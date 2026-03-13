/**
 * Logging utility. Wraps console so the implementation can be swapped
 * (e.g., for a structured logger) without changing call sites.
 *
 * @type {{
 *   log: (...args: unknown[]) => void;
 *   error: (...args: unknown[]) => void;
 *   warn: (...args: unknown[]) => void;
 *   info: (...args: unknown[]) => void;
 *   debug: (...args: unknown[]) => void;
 * }}
 */
export const logger = {
  /** @param {...unknown} args */
  log: (...args) => console.log(...args),
  /** @param {...unknown} args */
  error: (...args) => console.error(...args),
  /** @param {...unknown} args */
  warn: (...args) => console.warn(...args),
  /** @param {...unknown} args */
  info: (...args) => console.info(...args),
  /** @param {...unknown} args */
  debug: (...args) => console.debug(...args)
};
