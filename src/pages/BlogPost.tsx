import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Calendar, Clock, User, ArrowLeft, Share2, Copy, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SiteFooter } from "@/components/umoja/SiteFooter";
import { Logo } from "@/components/umoja/Logo";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";

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

const SITE = "https://umoja-sparkle-ui.lovable.app";

export default function BlogPost() {
  const { slug } = useParams();
  const [post, setPost] = useState<Post | null>(null);
  const [related, setRelated] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from("blog_posts")
        .select("*")
        .eq("slug", slug)
        .eq("published", true)
        .maybeSingle();
      setPost((data as Post) ?? null);
      if (data) {
        const { data: rel } = await supabase
          .from("blog_posts")
          .select("id,slug,title,excerpt,content,featured_image,author_name,category,published_at,read_time_minutes")
          .eq("published", true)
          .neq("id", (data as Post).id)
          .order("published_at", { ascending: false })
          .limit(3);
        setRelated((rel as Post[]) ?? []);
      }
      setLoading(false);
    })();
  }, [slug]);

  const url = `${SITE}/blog/${slug}`;
  const shareText = post ? encodeURIComponent(post.title) : "";

  const copyLink = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    toast({ title: "Link copied" });
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading…</div>;
  }
  if (!post) {
    return (
      <div className="min-h-screen grid place-items-center text-center px-5">
        <div>
          <p className="font-display text-2xl">Post not found</p>
          <Button asChild className="mt-4"><Link to="/blog">Back to Blog</Link></Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>{post.title} — UMOJA Blog</title>
        <meta name="description" content={post.excerpt ?? post.title} />
        <link rel="canonical" href={url} />
        <meta property="og:title" content={post.title} />
        <meta property="og:description" content={post.excerpt ?? post.title} />
        <meta property="og:type" content="article" />
        <meta property="og:url" content={url} />
        {post.featured_image && <meta property="og:image" content={post.featured_image} />}
        <meta name="twitter:card" content="summary_large_image" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Article",
          headline: post.title,
          datePublished: post.published_at,
          author: { "@type": "Person", name: post.author_name ?? "UMOJA" },
          image: post.featured_image ?? undefined,
        })}</script>
      </Helmet>

      <header className="px-5 pt-6">
        <div className="mx-auto max-w-4xl flex items-center justify-between">
          <Logo />
          <Link to="/blog" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> All posts
          </Link>
        </div>
      </header>

      <article className="px-5 pt-10 pb-16">
        <div className="mx-auto max-w-3xl">
          {post.category && (
            <Badge variant="outline" className="mb-4">{post.category}</Badge>
          )}
          <h1 className="font-display text-4xl md:text-5xl font-semibold tracking-tight leading-tight">
            {post.title}
          </h1>
          {post.excerpt && (
            <p className="mt-5 text-lg text-muted-foreground leading-relaxed">{post.excerpt}</p>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground border-y border-border py-4">
            <span className="inline-flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-primary text-primary-foreground font-semibold">
                {(post.author_name ?? "U")[0]}
              </span>
              <span>
                <span className="block text-foreground font-medium">{post.author_name ?? "UMOJA"}</span>
                <span className="text-xs">UMOJA Founder</span>
              </span>
            </span>
            <span className="inline-flex items-center gap-1.5"><Calendar className="h-4 w-4" />{post.published_at ? new Date(post.published_at).toLocaleDateString("en-ZA", { year: "numeric", month: "long", day: "numeric" }) : ""}</span>
            <span className="inline-flex items-center gap-1.5"><Clock className="h-4 w-4" />{post.read_time_minutes ?? 5} min read</span>
          </div>

          {post.featured_image && (
            <img src={post.featured_image} alt={post.title} loading="lazy"
              className="mt-8 w-full rounded-2xl border border-border" />
          )}

          <div className="prose-blog mt-10">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{post.content}</ReactMarkdown>
          </div>

          {/* Share */}
          <div className="mt-12 border-t border-border pt-6">
            <p className="text-sm font-medium mb-3 inline-flex items-center gap-2"><Share2 className="h-4 w-4" /> Share this post</p>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm">
                <a href={`https://wa.me/?text=${shareText}%20${encodeURIComponent(url)}`} target="_blank" rel="noreferrer">WhatsApp</a>
              </Button>
              <Button asChild variant="outline" size="sm">
                <a href={`https://twitter.com/intent/tweet?text=${shareText}&url=${encodeURIComponent(url)}`} target="_blank" rel="noreferrer">Twitter</a>
              </Button>
              <Button asChild variant="outline" size="sm">
                <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`} target="_blank" rel="noreferrer">LinkedIn</a>
              </Button>
              <Button onClick={copyLink} variant="outline" size="sm">
                {copied ? <><Check className="h-3.5 w-3.5" /> Copied</> : <><Copy className="h-3.5 w-3.5" /> Copy link</>}
              </Button>
            </div>
          </div>

          {/* CTA */}
          <Card className="mt-12 border-accent/30 bg-gradient-card overflow-hidden">
            <CardContent className="p-8 text-center">
              <p className="text-[11px] uppercase tracking-[0.22em] text-accent">Join the movement</p>
              <h3 className="mt-2 font-display text-2xl md:text-3xl font-semibold">Become a Founder of UMOJA</h3>
              <p className="mt-3 text-muted-foreground max-w-lg mx-auto">Lock in lifetime priority and reduced fees. Founding spots are limited.</p>
              <Button asChild size="lg" className="mt-5 rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow">
                <Link to="/waitlist">Join UMOJA</Link>
              </Button>
            </CardContent>
          </Card>

          {/* Related */}
          {related.length > 0 && (
            <div className="mt-16">
              <h2 className="font-display text-2xl font-semibold mb-5">Related posts</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {related.map((p) => (
                  <Link key={p.id} to={`/blog/${p.slug}`} className="group">
                    <Card className="h-full border-border hover:border-accent/40 transition-smooth">
                      <CardContent className="p-5">
                        {p.category && <Badge variant="outline" className="mb-2 text-[10px]">{p.category}</Badge>}
                        <h3 className="font-display text-base font-semibold group-hover:text-accent line-clamp-2">{p.title}</h3>
                        {p.excerpt && <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{p.excerpt}</p>}
                        <p className="mt-3 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                          <User className="h-3 w-3" /> {p.author_name ?? "UMOJA"}
                        </p>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </article>

      <SiteFooter />
    </div>
  );
}
