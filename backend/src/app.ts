import express from "express";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import routes from "./routes";
import env from "./config/env";

import { AppError } from "./utils/AppError";
import { errorHandler } from "./middlewares/error.middleware";
import { requestContext } from "./utils/request-context";

const app = express();

app.disable("x-powered-by");

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  skip: req => new Set([
    `/api/${env.API_VERSION}/health/live`,
    `/api/${env.API_VERSION}/health/ready`,
  ]).has(req.path),
  message: {
    success: false,
    message: "Too many requests, please try again later.",
  },
});

// global middlewares
app.use(requestContext);

app.use(helmet());

app.use(
  cors({
    origin: env.CORS_ORIGIN.split(",").map(origin => origin.trim()).filter(Boolean),
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Request-Id"],
  })
);

app.use(apiLimiter);

app.use(compression());

app.use(cookieParser());

app.use(express.json({ limit: "1mb" }));

app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// root route
app.use(`/api/${env.API_VERSION}`, routes);

// handle unknown routes 
app.use((req, res, next) => {
  next(new AppError(`Route ${req.originalUrl} not found`, 404));
});

// global error handling middleware
app.use(errorHandler);

export default app;