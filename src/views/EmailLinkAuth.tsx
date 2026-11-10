"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  isSignInWithEmailLink,
  signInWithEmailLink,
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { getFirebaseAuth, requireFirebaseDb } from "@/integrations/firebase/client";
import { useToast } from "@/hooks/use-toast";
import { trackSignup } from "@/lib/analytics";
import { Loader2, MailCheck, AlertCircle, ArrowLeft } from "lucide-react";

type Status = "working" | "need-email" | "error" | "success";

function EmailLinkInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [status, setStatus] = useState<Status>("working");
  const [email, setEmail] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const completeSignIn = async (emailToUse: string) => {
    const auth = getFirebaseAuth();
    if (!auth) {
      setStatus("error");
      setErrorMessage("Firebase is not configured.");
      return;
    }
    try {
      const cred = await signInWithEmailLink(auth, emailToUse, window.location.href);
      // Ensure a profile doc exists (idempotent for returning users)
      try {
        const db = requireFirebaseDb();
        await setDoc(
          doc(db, "profiles", cred.user.uid),
          {
            id: cred.user.uid,
            user_id: cred.user.uid,
            display_name: cred.user.displayName || emailToUse.split("@")[0],
            avatar_url: cred.user.photoURL ?? null,
            updated_at: new Date().toISOString(),
          },
          { merge: true }
        );
      } catch {
        // Profile sync is best-effort; sign-in already succeeded
      }
      window.localStorage.removeItem("flixverse-emailForSignIn");
      trackSignup("email-link");
      setStatus("success");
      toast({
        title: "Welcome to FlixVerse!",
        description: "Signed in successfully.",
      });
      router.push("/");
    } catch (error: unknown) {
      setStatus("error");
      setErrorMessage(
        error instanceof Error ? error.message : "This link is invalid or expired. Request a new one."
      );
    }
  };

  useEffect(() => {
    const auth = getFirebaseAuth();
    if (!auth || !isSignInWithEmailLink(auth, window.location.href)) {
      setStatus("error");
      setErrorMessage("This link is not a valid sign-in link. Go back and request a new one.");
      return;
    }

    const stored = window.localStorage.getItem("flixverse-emailForSignIn");
    const queryEmail = searchParams.get("email");
    const emailToUse = queryEmail ?? stored ?? "";

    if (emailToUse) {
      void completeSignIn(emailToUse);
    } else {
      setStatus("need-email");
      setEmail("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (status === "working") {
    return (
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-red-500" />
        <p className="text-gray-400">Signing you in…</p>
      </div>
    );
  }

  if (status === "need-email") {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void completeSignIn(email.trim().toLowerCase());
        }}
        className="w-full space-y-4"
      >
        <p className="text-sm text-gray-400">
          Confirm the email you used to request the link so we can finish signing you in.
        </p>
        <input
          type="email"
          required
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full h-12 bg-black/40 border border-white/10 text-white placeholder-gray-500 rounded-md px-4 focus:border-red-500/60 focus:ring-red-500/20 focus-ring"
        />
        <button
          type="submit"
          className="w-full h-12 rounded-md bg-red-600 hover:bg-red-500 text-white font-bold transition-colors focus-ring"
        >
          Complete sign in
        </button>
      </form>
    );
  }

  if (status === "error") {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <AlertCircle className="h-10 w-10 text-red-500" />
        <p className="text-gray-300">{errorMessage}</p>
        <Link
          href="/auth"
          className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors focus-ring rounded"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <MailCheck className="h-10 w-10 text-emerald-400" />
      <p className="text-gray-300">Signed in — redirecting…</p>
    </div>
  );
}

export default function EmailLinkAuth() {
  return (
    <main className="min-h-screen bg-[#0a0a0c] flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center space-y-6">
        <h1 className="text-2xl font-black tracking-tight text-white">
          <span className="text-white">Flix</span>
          <span className="text-red-500">Verse</span>
        </h1>
        <Suspense fallback={<Loader2 className="mx-auto h-8 w-8 animate-spin text-red-500" />}>
          <EmailLinkInner />
        </Suspense>
      </div>
    </main>
  );
}
