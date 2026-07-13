import { Injectable } from "@nestjs/common";
import { NELNA_BRAND } from "@nelna/shared";

export type HealthResponse = {
  status: "healthy";
  service: string;
  product: string;
  version: string;
  environment: string;
  timestamp: string;
  checks: {
    api: "up";
  };
};

@Injectable()
export class HealthService {
  getHealth(): HealthResponse {
    return {
      status: "healthy",
      service: "nelna-fg-api",
      product: NELNA_BRAND.productName,
      version: "0.1.0",
      environment: process.env.NODE_ENV ?? "development",
      timestamp: new Date().toISOString(),
      checks: {
        api: "up",
      },
    };
  }
}
