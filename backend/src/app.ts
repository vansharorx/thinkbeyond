import express from "express";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import routes from "./routes";
import env from "./config/env";

const app = express();

// global middlewares
app.use(helmet());

app.use(cors({
  origin: "http://localhost:5173",
  credentials: true,
}));

app.use(compression());

app.use(cookieParser());

app.use(express.json());

app.use(express.urlencoded({ extended: true }));

app.use(morgan("dev"));

// root route
app.use(`/api/${env.API_VERSION}`, routes);

export default app;