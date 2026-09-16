import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14?target=deno";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

  if (!stripeKey || !webhookSecret) {
    return new Response("Stripe secrets not configured", { status: 500 });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });

  // Verify Stripe signature
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return new Response("Missing stripe-signature header", { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return new Response(`Webhook Error: ${err}`, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    // Payment Link sessions have metadata with project_id
    const projectId = session.metadata?.project_id;
    const userId    = session.metadata?.user_id;

    if (!projectId || !userId) {
      console.log("No project_id/user_id in session metadata — skipping");
      return new Response(JSON.stringify({ received: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Fetch the current project data
    const { data: row, error: fetchErr } = await supabase
      .from("projects")
      .select("data")
      .eq("id", projectId)
      .eq("user_id", userId)
      .maybeSingle();

    if (fetchErr || !row) {
      console.error("Project not found:", projectId, fetchErr);
      return new Response("Project not found", { status: 404 });
    }

    const project = row.data as Record<string, unknown>;
    const now = new Date().toISOString();

    const updated = {
      ...project,
      paid: true,
      paidAt: project.paidAt || now,
      kanbanStatus: "paid",
    };

    const { error: updateErr } = await supabase
      .from("projects")
      .update({ data: updated, updated_at: now })
      .eq("id", projectId)
      .eq("user_id", userId);

    if (updateErr) {
      console.error("Failed to update project:", updateErr);
      return new Response("Failed to update project", { status: 500 });
    }

    console.log(`Project ${projectId} marked as paid via Stripe webhook`);
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
