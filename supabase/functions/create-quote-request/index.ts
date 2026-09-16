import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const {
      customerName,
      customerEmail,
      materialType,
      weightGrams,
      printHours,
      quantity,
      estimatedPrice,
      notes,
    } = await req.json();

    const shopOwnerUserId = Deno.env.get("SHOP_OWNER_USER_ID");
    if (!shopOwnerUserId) {
      return new Response(
        JSON.stringify({ error: "SHOP_OWNER_USER_ID secret not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const projectId = crypto.randomUUID();
    const project = {
      id: projectId,
      name: customerName
        ? `Quote from ${customerName}`
        : `Quote Request — ${materialType ?? "Unknown"} ${weightGrams ?? 0}g`,
      customerName: customerName ?? "",
      customerEmail: customerEmail ?? "",
      customerSource: "Website",
      paymentMethod: "Other",
      orderDate: new Date().toISOString().split("T")[0],
      dueDate: "",
      totalPrice: estimatedPrice ?? 0,
      printed: false,
      paid: false,
      sent: false,
      shippingDate: "",
      notes: notes
        ? `Public quote request.\n${notes}`
        : `Public quote request. Material: ${materialType}, Weight: ${weightGrams}g, Print time: ${printHours}h, Qty: ${quantity}.`,
      kanbanStatus: "new-order",
      projectExpenses: [],
      prints: [
        {
          id: crypto.randomUUID(),
          name: materialType ? `${materialType} print` : "Print",
          estimatedPrintTime: printHours ?? 0,
          materialUsed: weightGrams ?? 0,
          printer: "",
          status: "not-printed",
          quantity: quantity ?? 1,
          completedQuantity: 0,
          color: "",
          material: materialType ?? "",
          pricePerPiece: estimatedPrice ?? 0,
        },
      ],
      importSource: "manual",
    };

    const { error: insertError } = await supabase
      .from("projects")
      .insert({ id: projectId, user_id: shopOwnerUserId, data: project });

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(
        JSON.stringify({ error: insertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Send notification email to shop owner
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const notificationEmail = Deno.env.get("NOTIFICATION_EMAIL");

    if (resendApiKey && notificationEmail) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "PrintTrack <noreply@printtrack.xyz>",
          to: [notificationEmail],
          subject: `New quote request from ${customerName || "anonymous"}`,
          html: `
            <h2>New Quote Request</h2>
            <p>A new quote request has been submitted via your public quote page.</p>
            <table style="border-collapse:collapse;width:100%;max-width:480px">
              <tr><td style="padding:6px;font-weight:600">Customer</td><td style="padding:6px">${customerName || "—"}</td></tr>
              <tr><td style="padding:6px;font-weight:600">Email</td><td style="padding:6px">${customerEmail || "—"}</td></tr>
              <tr><td style="padding:6px;font-weight:600">Material</td><td style="padding:6px">${materialType || "—"}</td></tr>
              <tr><td style="padding:6px;font-weight:600">Weight</td><td style="padding:6px">${weightGrams ?? "—"} g</td></tr>
              <tr><td style="padding:6px;font-weight:600">Print time</td><td style="padding:6px">${printHours ?? "—"} h</td></tr>
              <tr><td style="padding:6px;font-weight:600">Quantity</td><td style="padding:6px">${quantity ?? 1}</td></tr>
              <tr><td style="padding:6px;font-weight:600">Estimated price</td><td style="padding:6px">€${(estimatedPrice ?? 0).toFixed(2)}</td></tr>
              ${notes ? `<tr><td style="padding:6px;font-weight:600">Notes</td><td style="padding:6px">${notes}</td></tr>` : ""}
            </table>
            <p>The project has been created in your PrintTrack dashboard under New Orders.</p>
          `,
        }),
      });
    }

    return new Response(
      JSON.stringify({ success: true, projectId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
