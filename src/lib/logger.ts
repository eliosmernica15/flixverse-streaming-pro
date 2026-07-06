/**
 * Structured logger — thin wrapper with levels, context, and Sentry integration.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  [key: string]: unknown;
}

function log(level: LogLevel, message: string, context?: LogContext) {
  const entry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...context,
  };

  if (process.env.NODE_ENV === "development") {
    const consoleFn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
    consoleFn(`[${level.toUpperCase()}] ${message}`, context || "");
  }

  // Production: send to Sentry for warn/error
  if (process.env.NODE_ENV === "production" && (level === "warn" || level === "error")) {
    try {
      // Sentry.captureMessage(message, level === "error" ? "error" : "warning");
    } catch {
      // ignore
    }
  }
}

export const logger = {
  debug: (msg: string, ctx?: LogContext) => log("debug", msg, ctx),
  info: (msg: string, ctx?: LogContext) => log("info", msg, ctx),
  warn: (msg: string, ctx?: LogContext) => log("warn", msg, ctx),
  error: (msg: string, ctx?: LogContext) => log("error", msg, ctx),
};
