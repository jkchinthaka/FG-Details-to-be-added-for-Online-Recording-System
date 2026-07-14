import type { Metadata } from "next";
import { VehiclesAdmin } from "./VehiclesAdmin";

export const metadata: Metadata = {
  title: "Vehicles — Administration",
};

export default function AdminVehiclesPage() {
  return <VehiclesAdmin />;
}
