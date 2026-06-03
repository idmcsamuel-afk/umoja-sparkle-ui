import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { fbqPageView } from "@/lib/metaPixel";

const TITLES: Record<string, string> = {
  "/": "Home",
  "/login": "Sign in",
  "/signup": "Join",
  "/waitlist": "Waitlist",
  "/dashboard": "Dashboard",
  "/circle": "Circle",
  "/spark": "Spark Trade",
  "/drive": "Drive",
  "/predictor": "Predictor",
  "/profile": "Profile",
  "/calculator": "Calculator",
  "/market": "Market",
  "/exchange": "Exchange",
  "/property": "Property",
  "/flame-marketing": "Marketing AI",
  "/spark-pit": "Spark Pit",
  "/spark-pit/dream-draw": "Dream Draw",
  "/spark-pit/spark-flip": "Spark Flip",
  "/kyc": "Verification",
  "/referrals": "Invite Friends",
};

const titleFor = (path: string) => {
  if (TITLES[path]) return TITLES[path];
  if (path.startsWith("/admin")) {
    const seg = path.split("/").filter(Boolean).slice(1).join(" ") || "Console";
    return "Admin · " + seg.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return "App";
};

export const RouteTitle = () => {
  const { pathname } = useLocation();
  // Skip the very first mount: index.html already fires PageView on load,
  // so we only track subsequent SPA route changes here to avoid duplicates.
  const firstRender = useRef(true);
  useEffect(() => {
    document.title = `UMOJA — ${titleFor(pathname)}`;
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    fbqPageView();
  }, [pathname]);
  return null;
};
