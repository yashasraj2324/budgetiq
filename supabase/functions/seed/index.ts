// Demo seeding is disabled. Existing seeded records are preserved; this stub
// exists only to guarantee the endpoint can never create new demo data.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(() => {
  return new Response(
    JSON.stringify({ detail: "Demo seeding is disabled. Existing seeded records are preserved." }),
    { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
