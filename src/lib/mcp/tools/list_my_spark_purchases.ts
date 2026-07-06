import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function userClient(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "list_my_spark_purchases",
  title: "List my Spark Trade purchases",
  description: "List the signed-in member's Spark Trade product reservations/purchases with status, units, capital allocated, and payment reference.",
  inputSchema: {
    limit: z.number().int().min(1).max(100).optional().describe("Max rows to return (default 25)."),
    status: z.string().optional().describe("Optional reservation_status filter, e.g. 'paid', 'reserved', 'shipped'."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, status }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = userClient(ctx);
    let query = supabase
      .from("spark_trade_inventory_reservations")
      .select("id, opportunity_id, units_reserved, total_capital_allocated, reservation_status, payment_reference, reserved_at, paid_at, shipped_at, received_at")
      .eq("member_id", ctx.getUserId())
      .order("reserved_at", { ascending: false })
      .limit(limit ?? 25);
    if (status) query = query.eq("reservation_status", status);
    const { data, error } = await query;
    if (error) {
      return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
    }
    const rows = data ?? [];
    return {
      content: [{ type: "text", text: rows.length ? JSON.stringify(rows, null, 2) : "No purchases found." }],
      structuredContent: { purchases: rows, count: rows.length },
    };
  },
});
