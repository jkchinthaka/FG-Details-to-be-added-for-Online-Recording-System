import type { Metadata } from "next";
import { DriversAdmin } from "./DriversAdmin";

export const metadata: Metadata = {
  title: "Drivers — Administration",
};

export default function AdminDriversPage() {
  return <DriversAdmin />;
}
