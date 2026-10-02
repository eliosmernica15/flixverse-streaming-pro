"use client";

import { useState, useRef, useEffect } from "react";
import { Lock, AlertTriangle } from "lucide-react";

interface ParentalPinGateProps {
  /** Expected PIN hash (bcrypt) to verify against */
  pinHash?: string | null;
  /** Called when the correct PIN is entered */
  onVerified: () => void;
  /** Called when user wants to go back */
  onCancel: () => void;
  profileName?: string;
}

export function ParentalPinGate({
  pinHash,
  onVerified,
  onCancel,
  profileName = "this profile",
}: ParentalPinGateProps) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const handleDigit = (digit: string, index: number) => {
    const newPin = pin.split("");
    newPin[index] = digit;
    const newPinStr = newPin.join("").slice(0, 4);
    setPin(newPinStr);
    setError(false);

    // Auto-advance
    if (digit && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when 4 digits entered
    if (newPinStr.length === 4) {
      verifyPin(newPinStr);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === "Backspace" && !pin[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === "Escape") {
      onCancel();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 4);
    if (pasted.length === 4) {
      setPin(pasted);
      verifyPin(pasted);
    }
  };

  const verifyPin = async (enteredPin: string) => {
    setVerifying(true);
    setError(false);

    // Simple hash comparison (in production, use bcrypt on the server)
    // For now, we store PINs as simple hashes
    const simpleHash = (s: string) => {
      let hash = 0;
      for (let i = 0; i < s.length; i++) {
        const char = s.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0;
      }
      return hash.toString(36);
    };

    // Simulate verification delay
    await new Promise((r) => setTimeout(r, 300));

    if (!pinHash || simpleHash(enteredPin) === pinHash) {
      onVerified();
    } else {
      setError(true);
      setPin("");
      setTimeout(() => {
        setError(false);
        inputRefs.current[0]?.focus();
      }, 1500);
    }
    setVerifying(false);
  };

  return (
    <div className="fixed inset-0 z-[10002] flex items-center justify-center bg-black p-4">
      <div className="glass-strong w-full max-w-sm animate-scale-in rounded-3xl p-8 text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/20 to-orange-600/20">
          <Lock className="h-8 w-8 text-amber-400" />
        </div>

        <h1 className="mb-1 text-xl font-bold text-white">PIN Required</h1>
        <p className="mb-8 text-sm text-gray-400">
          Enter the 4-digit PIN to access {profileName}
        </p>

        {/* PIN input */}
        <div className="mb-4 flex items-center justify-center gap-3">
          {[0, 1, 2, 3].map((i) => (
            <input
              key={i}
              ref={(el) => { inputRefs.current[i] = el; }}
              type="password"
              inputMode="numeric"
              maxLength={1}
              value={pin[i] || ""}
              onChange={(e) => handleDigit(e.target.value.replace(/\D/g, ""), i)}
              onKeyDown={(e) => handleKeyDown(e, i)}
              onPaste={handlePaste}
              disabled={verifying}
              className={`h-16 w-14 rounded-xl border-2 bg-white/5 text-center text-2xl font-bold text-white transition-all focus:outline-none focus-ring ${
                error
                  ? "border-red-500 bg-red-500/10 animate-shake"
                  : "border-white/10 focus:border-white/30"
              } ${verifying ? "opacity-50" : ""}`}
              aria-label={`PIN digit ${i + 1}`}
            />
          ))}
        </div>

        {error && (
          <div className="mb-4 flex animate-fade-in-up items-center justify-center gap-2 text-sm text-red-400">
            <AlertTriangle className="h-4 w-4" />
            Incorrect PIN. Please try again.
          </div>
        )}

        {verifying && (
          <p className="mb-4 text-sm text-gray-500">Verifying…</p>
        )}

        <button
          onClick={onCancel}
          className="text-sm text-gray-500 transition-colors hover:text-white focus-ring"
        >
          Back to profiles
        </button>
      </div>
    </div>
  );
}
