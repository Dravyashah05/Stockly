import winston from "winston";

const { env } = process.env.NODE_ENV === "production"
  ? { isProd: true }
  : { isProd: false };

const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: "stockly-api" },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
  ],
});

if (process.env.NODE_ENV === "production") {
  // In production, we use JSON format for logs to be easily parsed by log aggregators
  logger.format = winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  );
}

export default logger;
