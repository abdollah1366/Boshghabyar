import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { Icon } from '../components/Icon';
import { PageSkeleton } from '../components/ui';
import { api, errorMessage } from '../lib/api';
import { formatDate } from '../lib/format';
import { useDocumentTitle } from '../lib/hooks';

interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  bodyMd: string;
  coverEmoji: string;
  author: string;
  publishedAt: string;
}

/** رندر سادهٔ Markdown (فقط عنوان، پاراگراف و لیست) بدون dangerouslySetInnerHTML */
function renderMarkdown(md: string) {
  return md.split(/\n+/).map((block, i) => {
    if (block.startsWith('## ')) return <h2 key={i} style={{ marginTop: '1.5em' }}>{block.slice(3)}</h2>;
    if (block.startsWith('- ')) {
      return (
        <ul key={i} className="stack-xs" style={{ paddingInlineStart: '1.2em' }}>
          {block.split('\n').map((line, j) => (line.startsWith('- ') ? <li key={j}>{line.slice(2)}</li> : null))}
        </ul>
      );
    }
    return <p key={i}>{block}</p>;
  });
}

export function Blog() {
  useDocumentTitle('وبلاگ بشقاب‌یار');
  const [posts, setPosts] = useState<BlogPost[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api<{ posts: BlogPost[] }>('/api/blog')
      .then((r) => setPosts(r.posts))
      .catch((e) => setError(errorMessage(e)));
  }, []);

  return (
    <div className="page">
      <header className="stack-sm">
        <Link className="btn btn-ghost btn-sm" to="/" style={{ width: 'fit-content' }}>→ بازگشت به خانه</Link>
        <h1>وبلاگ بشقاب‌یار</h1>
        <p className="muted">دانستنی‌های تغذیه، راهنمای استفاده از اپ و نکته‌های سالم‌خوری ایرانی.</p>
      </header>

      {error && <p className="error">{error}</p>}
      {!posts && !error && <PageSkeleton />}

      <div className="grid grid-3">
        {posts?.map((post) => (
          <Link key={post.id} className="card card-hover" to={`/blog/${post.slug}`} style={{ textDecoration: 'none' }}>
            <div className="row between">
              <span style={{ fontSize: 40 }}>{post.coverEmoji}</span>
              <span className="tiny muted">{formatDate(post.publishedAt)}</span>
            </div>
            <h2 style={{ fontSize: 'var(--text-md)' }}>{post.title}</h2>
            <p className="small muted">{post.excerpt}</p>
            <span className="small" style={{ color: 'var(--primary)' }}>خواندن مطلب ←</span>
          </Link>
        ))}
      </div>

      {posts && posts.length === 0 && <p className="muted">هنوز مطلبی منتشر نشده است.</p>}
    </div>
  );
}

export function BlogPost() {
  const { slug } = useParams();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [error, setError] = useState('');
  useDocumentTitle(post ? post.title : 'مطلب وبلاگ');

  useEffect(() => {
    setPost(null);
    setError('');
    api<{ post: BlogPost }>(`/api/blog/${slug}`)
      .then((r) => setPost(r.post))
      .catch((e) => setError(errorMessage(e)));
  }, [slug]);

  return (
    <div className="page" style={{ maxWidth: 760 }}>
      <Link className="btn btn-ghost btn-sm" to="/blog" style={{ width: 'fit-content' }}>→ همهٔ مطالب</Link>
      {error && <p className="error">{error}</p>}
      {!post && !error && <PageSkeleton />}
      {post && (
        <article className="stack">
          <header className="stack-sm">
            <span style={{ fontSize: 56 }}>{post.coverEmoji}</span>
            <h1>{post.title}</h1>
            <p className="muted small">{post.author} · {formatDate(post.publishedAt)}</p>
          </header>
          <div className="prose">{renderMarkdown(post.bodyMd)}</div>
        </article>
      )}
    </div>
  );
}
