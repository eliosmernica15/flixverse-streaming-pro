import { redirect } from "next/navigation";

export default function ContactPage() {
  redirect("/help?tab=contact");
}