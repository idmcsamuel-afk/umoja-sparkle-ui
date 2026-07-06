import { createClient } from "@supabase/supabase-js";
import { defineTool } from "@lovable.dev/mcp-js";

export default defineTool({
  name: "get_platform_info",
  title: "Get UMOJA platform info",
  description: "Return public UMOJA platform info: current bank details, payment instructions, and active circle payout tiers.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async () => {
    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supabase
      .from("platform_settings")
      .select("bank_name, account_name, account_number, branch_code, payment_instructions, payouts_seed, payouts_growth, payouts_harvest, crypto_enabled")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? {}, null, 2) }],
      structuredContent: { platform: data ?? {} },
    };
  },
});
