import { redirect } from "next/navigation";
import { hasValidSession } from "@/lib/auth";
import ChatApp from "@/components/chat-app";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  if (!(await hasValidSession())) redirect("/login");
  return <ChatApp />;
}
