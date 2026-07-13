import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const corsOrigin = process.env.API_CORS_ORIGIN ?? "http://localhost:3000";
  app.enableCors({ origin: corsOrigin, credentials: true });

  const swaggerConfig = new DocumentBuilder()
    .setTitle("Nelna FG Digital Recording System API")
    .setDescription(
      "REST API for Finished Goods cleaning verification, freezer truck inspection, QA workflows and audit trails at Nelna Farm.",
    )
    .setVersion("0.1.0")
    .setContact("Chinthaka Jayaweera", "", "")
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("api/docs", app, document);

  const port = Number(process.env.API_PORT ?? 3001);
  await app.listen(port);
}

void bootstrap();
