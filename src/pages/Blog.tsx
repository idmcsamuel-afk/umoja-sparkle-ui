import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Search, Calendar, Clock, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SiteFooter } from "@/components/umoja/SiteFooter";
import { Logo } from "@/components/umoja/Logo";

type Post = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content: string;
  featured_image: string | null;
  author_name: string | null;
  category: string | null;
  published_at: string | null;
  read_time_minutes: number | null;
};

const CATEGORIES = [
  { value: "all", label: "All" },
  { value: "update", label: "Update" },
  { value: "guide", label: "Guide" },
  { value: "announcement", label: "Announcement" },
  { value: "success-story", label: "Success Story" },
];

const categoryColor = (cat: string | null) => {
  switch (cat) {
    case "guide": return "bg-primary/15 text-primary border-primary/30";
    case "announcement": return "bg-accent/15 text-accent border-accent/30";
    case "success-story": return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
    default: return "bg-secondary text-foreground border-border";
  }
};

export default function Blog() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("blog_posts")
        .select("id,slug,title,excerpt,content,featured_image,author_name,category,published_at,read_time_minutes")
        .eq("published", true)
        .order("published_at", { ascending: false });
      setPosts((data as Post[]) ?? []);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return posts.filter((p) => {
      if (category !== "all" && p.category !== category) return false;
      if (!q) return true;
      return (
        p.title.toLowerCase().includes(q) ||
        (p.excerpt ?? "").toLowerCase().includes(q)
      );
    });
  }, [posts, query, category]);

  const latest = filtered[0];
  const rest = filtered.slice(1);

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>UMOJA Blog — Updates, Guides & Success Stories</title>
        <meta name="description" content="Updates, guides and success stories from the UMOJA community wealth platform." />
        <link rel="canonical" href="https://umoja-sparkle-ui.lovable.app/blog" />
        <meta property="og:title" content="UMOJA Blog" />
        <meta property="og:description" content="Updates, guides and success stories from UMOJA." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://umoja-sparkle-ui.lovable.app/blog" />
      </Helmet>

      <header className="px-5 pt-6">
        <div className="mx-auto max-w-6xl flex items-center justify-between">
          <Logo />
          <nav className="flex items-center gap-4 text-sm">
            <Link to="/" className="text-muted-foreground hover:text-foreground transition-smooth">Home</Link>
            <Link to="/waitlist" className="text-muted-foreground hover:text-foreground transition-smooth">Waitlist</Link>
            <Link to="/login" className="text-muted-foreground hover:text-foreground transition-smooth">Sign in</Link>
          </nav>
        </div>
      </header>

      <section className="px-5 pt-12 pb-10">
        <div className="mx-auto max-w-6xl text-center">
          <p className="text-[11px] uppercase tracking-[0.22em] text-accent">UMOJA Blog</p>
          <h1 className="mt-3 font-display text-4xl md:text-5xl font-semibold tracking-tight">
            Updates, <span className="text-gradient-gold italic font-[450]">Guides</span> & Success Stories
          </h1>
          <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
            Insights from the UMOJA team and community — how the platform works, what's new, and member wins.
          </p>
        </div>
      </section>

      <section className="px-5 pb-6">
        <div className="mx-auto max-w-6xl flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search posts…"
              className="pl-9 h-11 rounded-2xl"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c.value}
                onClick={() => setCategory(c.value)}
                className={`px-3 py-1.5 rounded-full text-xs border transition-smooth ${
                  category === c.value
                    ? "bg-gradient-primary text-primary-foreground border-transparent shadow-glow"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <main className="px-5 pb-16">
        <div className="mx-auto max-w-6xl">
          {loading ? (
            <p className="text-center text-muted-foreground py-20">Loading posts…</p>
          ) : filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-20">No posts yet. Check back soon.</p>
          ) : (
            <>
              {latest && (
                <div className="mb-10">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-accent mb-3">Latest Post</p>
                  <PostCardLarge post={latest} />
                </div>
              )}
              {rest.length > 0 && (
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {rest.map((p) => <PostCard key={p.id} post={p} />)}
                </div>
              )}
            </>
          )}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

function readableDate(d: string | null) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-ZA", { year: "numeric", month: "short", day: "numeric" });
}

function PostCardLarge({ post }: { post: Post }) {
  return (
    <Link to={`/blog/${post.slug}`} className="block group">
      <Card className="overflow-hidden border-border hover:border-accent/40 transition-smooth bg-gradient-card">
        <div className="grid md:grid-cols-2">
          <div className="aspect-[16/10] md:aspect-auto bg-secondary overflow-hidden">
            {post.featured_image ? (
              <img src={post.featured_image} alt={post.title} loading="lazy"
                className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500" />
            ) : (
              <div className="h-full w-full bg-gradient-primary opacity-60" />
            )}
          </div>
          <CardContent className="p-6 md:p-8 flex flex-col justify-center gap-4">
            <Badge variant="outline" className={`w-fit ${categoryColor(post.category)}`}>{post.category ?? "post"}</Badge>
            <h2 className="font-display text-2xl md:text-3xl font-semibold tracking-tight group-hover:text-accent transition-smooth">
              {post.title}
            </h2>
            {post.excerpt && (
              <p className="text-muted-foreground line-clamp-3">{post.excerpt}</p>
            )}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><User className="h-3 w-3" />{post.author_name ?? "UMOJA"}</span>
              <span className="inline-flex items-center gap-1.5"><Calendar className="h-3 w-3" />{readableDate(post.published_at)}</span>
              <span className="inline-flex items-center gap-1.5"><Clock className="h-3 w-3" />{post.read_time_minutes ?? 5} min read</span>
            </div>
          </CardContent>
        </div>
      </Card>
    </Link>
  );
}

function PostCard({ post }: { post: Post }) {
  return (
    <Link to={`/blog/${post.slug}`} className="block group">
      <Card className="overflow-hidden h-full border-border hover:border-accent/40 transition-smooth bg-gradient-card">
        <div className="aspect-[16/10] bg-secondary overflow-hidden">
          {post.featured_image ? (
            <img src={post.featured_image} alt={post.title} loading="lazy"
              className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500" />
          ) : (
            <div className="h-full w-full bg-gradient-primary opacity-60" />
          )}
        </div>
        <CardContent className="p-5 flex flex-col gap-3">
          <Badge variant="outline" className={`w-fit ${categoryColor(post.category)}`}>{post.category ?? "post"}</Badge>
          <h3 className="font-display text-lg font-semibold leading-snug group-hover:text-accent transition-smooth line-clamp-2">
            {post.title}
          </h3>
          {post.excerpt && (
            <p className="text-sm text-muted-foreground line-clamp-3">{post.excerpt.slice(0, 150)}{post.excerpt.length > 150 ? "…" : ""}</p>
          )}
          <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground pt-2">
            <span className="inline-flex items-center gap-1"><User className="h-3 w-3" />{post.author_name ?? "UMOJA"}</span>
            <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />{readableDate(post.published_at)}</span>
            <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{post.read_time_minutes ?? 5} min</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
