import type { Metadata } from "next";
import { MasterDataAdmin } from "./MasterDataAdmin";

export const metadata: Metadata = {
  title: "Master Data — Administration",
};

export default function AdminMasterDataPage() {
  return <MasterDataAdmin />;
}
