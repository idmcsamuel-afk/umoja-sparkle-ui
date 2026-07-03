import { useParams } from "react-router-dom";
import umojaShare from "@/assets/umoja-share.mp4.asset.json";

const VIDEOS: Record<string, { url: string; title: string; description: string }> = {
  "umoja-intro": {
    url: umojaShare.url,
    title: "UMOJA — Watch this",
    description: "A quick intro to UMOJA. Tap play.",
  },
};

export default function ShareVideo() {
  const { slug = "" } = useParams();
  const video = VIDEOS[slug];

  if (!video) {
    return (
      <div className="min-h-screen grid place-items-center bg-background text-foreground p-6">
        <p className="text-sm text-muted-foreground">Video not found.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-4 gap-4">
      <video
        src={video.url}
        controls
        autoPlay
        playsInline
        className="w-full max-w-md rounded-2xl shadow-xl bg-black aspect-[9/16] object-contain"
      />
      <h1 className="font-display text-xl text-center">{video.title}</h1>
      <a
        href={video.url}
        download
        className="text-sm text-accent underline"
      >
        Download video
      </a>
    </div>
  );
}
