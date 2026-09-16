import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Accept the project id from either a POST body or GET query param
    let projectId: string | null = null;

    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      projectId = body?.id ?? null;
    }

    if (!projectId) {
      const url = new URL(req.url);
      projectId = url.searchParams.get("id");
    }

    if (!projectId) {
      return new Response(JSON.stringify({ error: "Missing id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data, error } = await supabase
      .from("projects")
      .select("data")
      .eq("id", projectId)
      .maybeSingle();

    if (error || !data) {
      return new Response(JSON.stringify({ found: false }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const project = data.data as Record<string, unknown>;

    // Return only public-safe fields — no cost, no notes, no customer details
    return new Response(
      JSON.stringify({
        found: true,
        name: project.name ?? "Order",
        kanbanStatus: project.kanbanStatus ?? "new-order",
        dueDate: project.dueDate ?? null,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
