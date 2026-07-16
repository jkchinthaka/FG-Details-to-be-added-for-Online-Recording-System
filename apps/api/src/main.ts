import cookieParser from "cookie-parser";
import helmet from "helmet";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { assertProductionEnv } from "./config/validate-production-env";
import { buildCorsOptions } from "./config/cors-origin";
import { requestIdMiddleware } from "./common/request-id.middleware";
import { structuredRequestLogger } from "./common/structured-logger.middleware";

async function bootstrap() {
  // Fail closed in production before the HTTP listener binds.
  assertProductionEnv();

  const app = await NestFactory.create(AppModule);
  const isProduction = process.env.NODE_ENV === "production";

  app.enableCors(buildCorsOptions());

  app.use(
    helmet({
      // API is JSON — CSP is enforced on the Next/Worker edge for HTML.
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      hsts: isProduction
        ? { maxAge: 63_072_000, includeSubDomains: true, preload: false }
        : false,
      frameguard: { action: "deny" },
      noSniff: true,
      referrerPolicy: { policy: "no-referrer" },
    }),
  );

  app.use(requestIdMiddleware);
  app.use(structuredRequestLogger);
  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // FG-SEC-002 — Swagger is development/UAT only.
  if (!isProduction) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle("Nelna FG Digital Recording System API")
      .setDescription(
        "REST API for Finished Goods cleaning verification, freezer truck inspection, QA workflows and audit trails at Nelna Farm.",
      )
      .setVersion("1.0.0")
      .setContact("Chinthaka Jayaweera", "", "")
      .addCookieAuth("nelna_access_token")
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup("api/docs", app, document);
  }

  const port = Number(process.env.PORT ?? process.env.API_PORT ?? 3001);
  await app.listen(port, "0.0.0.0");
}

void bootstrap();
