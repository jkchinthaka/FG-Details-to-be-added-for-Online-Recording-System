import type { Metadata } from "next";
import { TransportersAdmin } from "./TransportersAdmin";

export const metadata: Metadata = {
  title: "Transporters — Administration",
};

export default function AdminTransportersPage() {
  return <TransportersAdmin />;
}
