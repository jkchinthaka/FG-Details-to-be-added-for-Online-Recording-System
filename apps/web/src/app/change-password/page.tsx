import type { Metadata } from "next";
import { Suspense } from "react";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";

export const metadata: Metadata = {
  title: "Change password",
};

export default function ChangePasswordPage() {
  return (
    <Suspense>
      <ChangePasswordForm />
    </Suspense>
  );
}
