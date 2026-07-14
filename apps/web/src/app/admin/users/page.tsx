import type { Metadata } from "next";
import { UsersAdmin } from "./UsersAdmin";

export const metadata: Metadata = {
  title: "Users — Administration",
};

export default function AdminUsersPage() {
  return <UsersAdmin />;
}
