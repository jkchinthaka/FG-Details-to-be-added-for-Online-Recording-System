import { Injectable } from "@nestjs/common";
import { NELNA_BRAND } from "@nelna/shared";

export type HealthResponse = {
  status: "ok";
  service: string;
  product: string;
  timestamp: string;
};

@Injectable()
export class HealthService {
  getHealth(): HealthResponse {
    return {
      status: "ok",
      service: "nelna-fg-api",
      product: NELNA_BRAND.productName,
      timestamp: new Date().toISOString(),
    };
  }
}
