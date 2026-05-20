// Creator Studio (ZCreator) subscription tiers — kept separate from the main platform subscription.
export type ZCreatorTier = "free" | "creator" | "pro" | "agency";

export interface ZCreatorTierConfig {
  id: ZCreatorTier;
  name: string;
  tagline: string;
  videosPerMonth: number;
  platforms: string[]; // 'youtube' | 'tiktok' | 'instagram'
  voice: string;
  premiumVoiceSurcharge: number | null; // rands per video, null = not allowed
  autoPublish: boolean;
  whiteLabel: boolean;
  apiAccess: boolean;
  priority: boolean;
  monthlyRands: number;
  monthlySparks: number;
  highlight?: boolean;
  ctaLabel: string;
  features: string[];
}

export const ZCREATOR_TIERS: ZCreatorTierConfig[] = [
  {
    id: "free",
    name: "Free",
    tagline: "Try Creator Studio",
    videosPerMonth: 2,
    platforms: ["youtube"],
    voice: "Standard only",
    premiumVoiceSurcharge: null,
    autoPublish: false,
    whiteLabel: false,
    apiAccess: false,
    priority: false,
    monthlyRands: 0,
    monthlySparks: 0,
    ctaLabel: "Current Plan",
    features: [
      "2 videos / month",
      "YouTube only",
      "Standard voice (free Edge TTS)",
      "Manual publishing",
    ],
  },
  {
    id: "creator",
    name: "Creator",
    tagline: "For Content Creators",
    videosPerMonth: 150,
    platforms: ["youtube", "tiktok", "instagram"],
    voice: "Standard + Premium option",
    premiumVoiceSurcharge: 6,
    autoPublish: true,
    whiteLabel: false,
    apiAccess: false,
    priority: false,
    monthlyRands: 400,
    monthlySparks: 4000,
    highlight: true,
    ctaLabel: "Upgrade to Creator",
    features: [
      "150 videos / month",
      "YouTube, TikTok & Instagram",
      "Premium voice +R6/video",
      "Auto-publishing",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "For Serious Creators",
    videosPerMonth: 400,
    platforms: ["youtube", "tiktok", "instagram"],
    voice: "Premium voice discount",
    premiumVoiceSurcharge: 4,
    autoPublish: true,
    whiteLabel: false,
    apiAccess: false,
    priority: true,
    monthlyRands: 800,
    monthlySparks: 8000,
    ctaLabel: "Upgrade to Pro",
    features: [
      "400 videos / month",
      "All platforms",
      "Premium voice +R4/video",
      "Priority generation",
      "Advanced analytics",
    ],
  },
  {
    id: "agency",
    name: "Agency",
    tagline: "For Content Agencies",
    videosPerMonth: 1000,
    platforms: ["youtube", "tiktok", "instagram"],
    voice: "Best premium voice rate",
    premiumVoiceSurcharge: 3,
    autoPublish: true,
    whiteLabel: true,
    apiAccess: true,
    priority: true,
    monthlyRands: 1600,
    monthlySparks: 16000,
    ctaLabel: "Upgrade to Agency",
    features: [
      "1000 videos / month",
      "White-label option",
      "Premium voice +R3/video",
      "Multiple agents",
      "API access",
    ],
  },
];

export const getTierConfig = (tier?: string | null): ZCreatorTierConfig =>
  ZCREATOR_TIERS.find((t) => t.id === (tier ?? "free")) ?? ZCREATOR_TIERS[0];

export const usagePct = (used: number, limit: number) =>
  limit <= 0 ? 0 : Math.min(100, Math.round((used / limit) * 100));

export const usageColor = (pct: number) => {
  if (pct >= 100) return "text-red-500 bg-red-500/15 border-red-500/30";
  if (pct >= 80) return "text-red-500 bg-red-500/10 border-red-500/30";
  if (pct >= 50) return "text-amber-500 bg-amber-500/10 border-amber-500/30";
  return "text-green-500 bg-green-500/10 border-green-500/30";
};
