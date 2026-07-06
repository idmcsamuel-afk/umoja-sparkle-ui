import { auth, defineMcp } from "@lovable.dev/mcp-js";
import whoamiTool from "./tools/whoami";
import listMySparkPurchasesTool from "./tools/list_my_spark_purchases";
import getPlatformInfoTool from "./tools/get_platform_info";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "umoja-mcp",
  title: "UMOJA",
  version: "0.1.0",
  instructions:
    "Tools for UMOJA — a South African community wealth platform (circles, Spark Trade, sparks). Use whoami to identify the signed-in member, list_my_spark_purchases to see the member's Spark Trade orders, and get_platform_info for public banking/payout info.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [whoamiTool, listMySparkPurchasesTool, getPlatformInfoTool],
});
