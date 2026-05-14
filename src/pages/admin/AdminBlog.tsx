import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Plus, Edit, Trash2, Eye, EyeOff, ExternalLink, Save, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
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
  published: boolean;
  published_at: string | null;
  read_time_minutes: number | null;
  updated_at: string;
};

const CATEGORIES = ["update", "guide", "announcement", "success-story"];

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-");

const calcReadTime = (content: string) => {
  const words = content.trim().split(/\s+/).length;
  return Math.max(1, Math.ceil(words / 200));
};

const empty = (): Partial<Post> => ({
  slug: "",
  title: "",
  excerpt: "",
  content: "",
  featured_image: "",
  category: "update",
  author_name: "Mcsamuel",
  published: false,
  read_time_minutes: 1,
});

export default function AdminBlog() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Post> | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("blog_posts")
      .select("*")
      .order("updated_at", { ascending: false });
    setPosts((data as Post[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const startNew = () => setEditing(empty());
  const startEdit = (p: Post) => setEditing({ ...p });
  const cancel = () => setEditing(null);

  const onTitleChange = (title: string) => {
    setEditing((e) => {
      if (!e) return e;
      const next = { ...e, title };
      if (!e.id && (!e.slug || e.slug === slugify(e.title ?? ""))) {
        next.slug = slugify(title);
      }
      return next;
    });
  };

  const save = async () => {
    if (!editing) return;
    if (!editing.title || !editing.slug || !editing.content) {
      toast({ title: "Title, slug and content required", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload: any = {
      slug: editing.slug,
      title: editing.title,
      excerpt: editing.excerpt || null,
      content: editing.content,
      featured_image: editing.featured_image || null,
      category: editing.category || "update",
      author_name: editing.author_name || "Mcsamuel",
      published: !!editing.published,
      read_time_minutes: calcReadTime(editing.content || ""),
    };
    if (editing.published && !editing.published_at) payload.published_at = new Date().toISOString();

    let error;
    if (editing.id) {
      ({ error } = await supabase.from("blog_posts").update(payload).eq("id", editing.id));
    } else {
      ({ error } = await supabase.from("blog_posts").insert(payload));
    }
    setSaving(false);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: editing.id ? "Post updated" : "Post created" });
    setEditing(null);
    load();
  };

  const togglePublish = async (p: Post) => {
    const next = !p.published;
    const { error } = await supabase.from("blog_posts").update({
      published: next,
      published_at: next && !p.published_at ? new Date().toISOString() : p.published_at,
    }).eq("id", p.id);
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    toast({ title: next ? "Published" : "Unpublished" });
    load();
  };

  const remove = async (p: Post) => {
    if (!confirm(`Delete "${p.title}"? This cannot be undone.`)) return;
    const { error } = await supabase.from("blog_posts").delete().eq("id", p.id);
    if (error) return toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    toast({ title: "Post deleted" });
    load();
  };

  const drafts = useMemo(() => posts.filter((p) => !p.published), [posts]);
  const published = useMemo(() => posts.filter((p) => p.published), [posts]);

  if (editing) {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-accent">Blog CMS</p>
            <h1 className="font-display text-2xl">{editing.id ? "Edit post" : "New post"}</h1>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={cancel}><X className="h-4 w-4" />Cancel</Button>
            <Button onClick={save} disabled={saving}>
              <Save className="h-4 w-4" />{saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-5">
          <Card>
            <CardContent className="p-5 space-y-4">
              <div>
                <Label>Title</Label>
                <Input value={editing.title ?? ""} onChange={(e) => onTitleChange(e.target.value)} />
              </div>
              <div>
                <Label>Slug</Label>
                <Input value={editing.slug ?? ""} onChange={(e) => setEditing({ ...editing, slug: slugify(e.target.value) })} />
              </div>
              <div>
                <Label>Excerpt</Label>
                <Textarea rows={3} value={editing.excerpt ?? ""} onChange={(e) => setEditing({ ...editing, excerpt: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Category</Label>
                  <Select value={editing.category ?? "update"} onValueChange={(v) => setEditing({ ...editing, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Author</Label>
                  <Input value={editing.author_name ?? ""} onChange={(e) => setEditing({ ...editing, author_name: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Featured image URL</Label>
                <Input value={editing.featured_image ?? ""} onChange={(e) => setEditing({ ...editing, featured_image: e.target.value })} placeholder="https://…" />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <Label className="cursor-pointer">Published</Label>
                  <p className="text-xs text-muted-foreground">Visible on /blog when on</p>
                </div>
                <Switch checked={!!editing.published} onCheckedChange={(v) => setEditing({ ...editing, published: v })} />
              </div>
              <div className="text-xs text-muted-foreground">
                Read time: ~{calcReadTime(editing.content || "")} min
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <Tabs defaultValue="write">
                <TabsList>
                  <TabsTrigger value="write">Write</TabsTrigger>
                  <TabsTrigger value="preview">Preview</TabsTrigger>
                </TabsList>
                <TabsContent value="write" className="mt-3">
                  <Textarea
                    rows={22}
                    value={editing.content ?? ""}
                    onChange={(e) => setEditing({ ...editing, content: e.target.value })}
                    placeholder="Markdown content. Supports # headings, **bold**, lists, > blockquotes, `code`, [links](url) and images."
                    className="font-mono text-sm"
                  />
                </TabsContent>
                <TabsContent value="preview" className="mt-3">
                  <div className="prose-blog max-h-[600px] overflow-y-auto p-4 border border-border rounded-lg">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{editing.content || "*Nothing to preview.*"}</ReactMarkdown>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-accent">Blog CMS</p>
          <h1 className="font-display text-2xl">Posts</h1>
        </div>
        <Button onClick={startNew}><Plus className="h-4 w-4" /> New post</Button>
      </div>

      <Tabs defaultValue="published">
        <TabsList>
          <TabsTrigger value="published">Published ({published.length})</TabsTrigger>
          <TabsTrigger value="drafts">Drafts ({drafts.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="published" className="mt-4"><PostTable posts={published} loading={loading} onEdit={startEdit} onDelete={remove} onToggle={togglePublish} /></TabsContent>
        <TabsContent value="drafts" className="mt-4"><PostTable posts={drafts} loading={loading} onEdit={startEdit} onDelete={remove} onToggle={togglePublish} /></TabsContent>
      </Tabs>
    </div>
  );
}

function PostTable({ posts, loading, onEdit, onDelete, onToggle }: {
  posts: Post[]; loading: boolean;
  onEdit: (p: Post) => void; onDelete: (p: Post) => void; onToggle: (p: Post) => void;
}) {
  if (loading) return <p className="text-muted-foreground text-sm">Loading…</p>;
  if (posts.length === 0) return <p className="text-muted-foreground text-sm">No posts here yet.</p>;
  return (
    <div className="space-y-3">
      {posts.map((p) => (
        <Card key={p.id}>
          <CardContent className="p-4 flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline">{p.category ?? "post"}</Badge>
                <span className="text-xs text-muted-foreground">/{p.slug}</span>
              </div>
              <p className="font-medium truncate mt-1">{p.title}</p>
              <p className="text-xs text-muted-foreground">
                {p.published_at ? `Published ${new Date(p.published_at).toLocaleDateString()}` : "Draft"} · {p.read_time_minutes ?? 1} min read · by {p.author_name ?? "—"}
              </p>
            </div>
            <div className="flex gap-1.5">
              {p.published && (
                <Button asChild variant="ghost" size="sm" title="View live">
                  <Link to={`/blog/${p.slug}`} target="_blank"><ExternalLink className="h-4 w-4" /></Link>
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => onToggle(p)} title={p.published ? "Unpublish" : "Publish"}>
                {p.published ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => onEdit(p)}><Edit className="h-4 w-4" /></Button>
              <Button variant="ghost" size="sm" onClick={() => onDelete(p)} className="text-destructive hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
