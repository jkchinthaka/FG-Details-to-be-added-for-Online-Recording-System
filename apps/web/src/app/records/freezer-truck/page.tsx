import type { Metadata } from "next";
import { FreezerTruckForm } from "@/components/FreezerTruckForm";

export const metadata: Metadata = {
  title: "Freezer Truck Inspection",
};

export default function FreezerTruckRecordPage() {
  return <FreezerTruckForm />;
}
