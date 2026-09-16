import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify caller is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    );
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      return new Response(
        JSON.stringify({ error: "RESEND_API_KEY secret not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { projectId, projectName, customerEmail, shippingDate } = await req.json();

    if (!customerEmail) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "No customer email on file" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const dateStr = shippingDate
      ? new Date(shippingDate).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })
      : new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "PrintTrack <noreply@printtrack.xyz>",
        to: [customerEmail],
        subject: `Your order has shipped: ${projectName}`,
        html: `
          <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#1a1a1a">
            <h2 style="margin-bottom:4px">Your order has shipped! 📦</h2>
            <p style="color:#555;margin-top:4px">Great news — your 3D print order is on its way.</p>
            <table style="border-collapse:collapse;width:100%;margin:24px 0;background:#f9f9f9;border-radius:8px;overflow:hidden">
              <tr>
                <td style="padding:12px 16px;font-weight:600;width:140px">Order</td>
                <td style="padding:12px 16px">${projectName}</td>
              </tr>
              <tr style="background:#f2f2f2">
                <td style="padding:12px 16px;font-weight:600">Shipped on</td>
                <td style="padding:12px 16px">${dateStr}</td>
              </tr>
            </table>
            <p style="color:#555">Thank you for your order! If you have any questions, just reply to this email.</p>
          </div>
        `,
      }),
    });

    if (!emailRes.ok) {
      const errBody = await emailRes.text();
      console.error("Resend error:", errBody);
      return new Response(JSON.stringify({ error: `Resend error: ${errBody}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ sent: true, to: customerEmail }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
