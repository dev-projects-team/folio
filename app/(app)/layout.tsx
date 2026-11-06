import { Suspense } from "react";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import Sidebar from "@/components/Sidebar";

// Reads the session cookie, so it streams behind Suspense (Next 16 cache components).
async function Gate({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  return (
    <div className="flex h-full">
      <Sidebar login={user.login} avatar={user.avatar} />
      <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="h-full bg-[#f7f6f3]" />}>
      <Gate>{children}</Gate>
    </Suspense>
  );
}
