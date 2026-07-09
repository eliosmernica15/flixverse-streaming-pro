"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { CreditCard, Crown, ExternalLink, Loader2, Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { useToast } from "@/hooks/use-toast";
import { getAuthHeaders } from "@/lib/firebase/clientAuth";
import {
  formatBillingDate,
  formatPlanLabel,
  formatSubscriptionStatus,
  statusBadgeClass,
} from "@/lib/billing/format";

interface InvoiceRow {
  id: string;
  number: string | null;
  status: string | null;
  amountDue: number;
  currency: string;
  created: number | null;
  hostedInvoiceUrl: string | null;
}

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

export function SubscriptionBilling() {
  const { user } = useAuth();
  const { subscription, loading, isPaid, hasPremium } = useSubscription();
  const { toast } = useToast();
  const [portalLoading, setPortalLoading] = useState(false);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);

  useEffect(() => {
    if (!user || !subscription.stripeCustomerId) return;

    async function loadInvoices() {
      setInvoicesLoading(true);
      try {
        const headers = await getAuthHeaders(user);
        const res = await fetch("/api/billing/invoices", { headers });
        const data = await res.json();
        if (res.ok) setInvoices(data.invoices || []);
      } catch {
        // optional
      } finally {
        setInvoicesLoading(false);
      }
    }

    void loadInvoices();
  }, [user, subscription.stripeCustomerId]);

  const handleManageBilling = async () => {
    if (!user) return;
    setPortalLoading(true);
    try {
      const headers = await getAuthHeaders(user);
      const res = await fetch("/api/billing/portal", {
        method: "POST",
        headers,
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({
          title: "Billing portal unavailable",
          description: data.error || "Stripe is not configured.",
          variant: "destructive",
        });
        return;
      }
      if (data.url) window.location.href = data.url;
    } catch {
      toast({ title: "Could not open billing portal", variant: "destructive" });
    } finally {
      setPortalLoading(false);
    }
  };

  const PlanIcon =
    subscription.plan === "premium" ? Crown : subscription.plan === "standard" ? Sparkles : Zap;

  const renewalLabel =
    subscription.status === "trialing"
      ? "Trial ends"
      : subscription.status === "canceled"
        ? "Access until"
        : "Renews on";

  return (
    <section className="glass-card rounded-2xl border border-white/10 p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/10 flex items-center justify-center border border-white/10">
          <CreditCard className="w-5 h-5 text-amber-400" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-white">Subscription & billing</h3>
          <p className="text-sm text-gray-500">Your plan, renewal date, and payment settings</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 rounded-xl bg-white/5 border border-white/5">
            <div className="flex items-center gap-3">
              <div
                className={`w-11 h-11 rounded-xl flex items-center justify-center border ${
                  hasPremium
                    ? "bg-gradient-to-br from-yellow-500/20 to-amber-600/10 border-yellow-500/20"
                    : isPaid
                      ? "bg-gradient-to-br from-red-500/20 to-orange-500/10 border-red-500/20"
                      : "bg-white/5 border-white/10"
                }`}
              >
                <PlanIcon
                  className={`w-5 h-5 ${
                    hasPremium ? "text-yellow-400" : isPaid ? "text-red-400" : "text-gray-400"
                  }`}
                />
              </div>
              <div>
                <p className="text-base font-semibold text-white">
                  {formatPlanLabel(subscription.plan)} plan
                </p>
                <span
                  className={`inline-flex mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide border ${statusBadgeClass(subscription.status)}`}
                >
                  {formatSubscriptionStatus(subscription.status)}
                </span>
              </div>
            </div>

            {isPaid && subscription.currentPeriodEnd && (
              <div className="text-left sm:text-right">
                <p className="text-xs text-gray-500 uppercase tracking-wide">{renewalLabel}</p>
                <p className="text-sm font-medium text-white">
                  {formatBillingDate(subscription.currentPeriodEnd)}
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            {subscription.stripeCustomerId ? (
              <Button
                onClick={() => void handleManageBilling()}
                disabled={portalLoading}
                className="bg-white/10 hover:bg-white/15 border border-white/10 text-white"
              >
                {portalLoading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <CreditCard className="w-4 h-4 mr-2" />
                )}
                Manage billing
              </Button>
            ) : (
              <Button asChild className="bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-500 hover:to-orange-400">
                <Link href="/plans">
                  <Sparkles className="w-4 h-4 mr-2" />
                  {subscription.plan === "free" ? "Upgrade plan" : "View plans"}
                </Link>
              </Button>
            )}

            {!hasPremium && isPaid && (
              <Button asChild variant="outline" className="border-yellow-500/30 text-yellow-300 hover:bg-yellow-500/10">
                <Link href="/plans">Upgrade to Premium</Link>
              </Button>
            )}
          </div>

          {subscription.status === "past_due" && (
            <p className="text-xs text-amber-400/90 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              Your last payment failed. Update your payment method to keep your subscription active.
            </p>
          )}

          {subscription.stripeCustomerId && (
            <div className="pt-2 border-t border-white/5">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">Recent invoices</p>
              {invoicesLoading ? (
                <div className="flex items-center gap-2 text-gray-500 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading…
                </div>
              ) : invoices.length === 0 ? (
                <p className="text-sm text-gray-600">No invoices yet.</p>
              ) : (
                <ul className="space-y-2">
                  {invoices.map((inv) => (
                    <li
                      key={inv.id}
                      className="flex items-center justify-between gap-3 p-3 rounded-lg bg-white/5 text-sm"
                    >
                      <div>
                        <p className="text-white font-medium">
                          {inv.number || inv.id.slice(-8)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {inv.created ? formatBillingDate(inv.created) : "—"} · {inv.status}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-gray-300">
                          {formatMoney(inv.amountDue, inv.currency)}
                        </span>
                        {inv.hostedInvoiceUrl && (
                          <a
                            href={inv.hostedInvoiceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-amber-400 hover:text-amber-300"
                            aria-label="View invoice"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
