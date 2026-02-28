import type { Env } from '../types.js';

interface SupabaseUser {
  id: string;
  github_id: string | null;
  username: string | null;
  email: string;
  plan: 'free' | 'pro';
  created_at: string;
}

interface SupabaseBlog {
  id: string;
  user_id: string;
  title: string;
  subdomain: string;
  custom_domain: string | null;
  created_at: string;
  updated_at: string;
}

interface SupabasePost {
  id: string;
  blog_id: string;
  slug: string;
  title: string;
  status: 'draft' | 'published';
  published_at: string | null;
  created_at: string;
}

export function createSupabaseClient(env: Env) {
  const supabaseUrl = env.SUPABASE_URL;
  const supabaseKey = env.SUPABASE_SERVICE_KEY;

  async function query<T>(
    table: string,
    options: {
      select?: string;
      filter?: Record<string, string | number>;
      single?: boolean;
      insert?: Record<string, unknown>;
      update?: Record<string, unknown>;
      upsert?: Record<string, unknown>;
      onConflict?: string;
    } = {}
  ): Promise<T | null> {
    let url = `${supabaseUrl}/rest/v1/${table}`;
    const params = new URLSearchParams();

    if (options.select) {
      params.set('select', options.select);
    }

    if (options.filter) {
      for (const [key, value] of Object.entries(options.filter)) {
        params.set(key, `eq.${value}`);
      }
    }

    if (options.onConflict) {
      params.set('on_conflict', options.onConflict);
    }

    const queryString = params.toString();
    if (queryString) {
      url += `?${queryString}`;
    }

    const headers: Record<string, string> = {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
    };

    if (options.single) {
      headers['Accept'] = 'application/vnd.pgrst.object+json';
    }

    let method = 'GET';
    let body: string | undefined;

    if (options.insert) {
      method = 'POST';
      body = JSON.stringify(options.insert);
      headers['Prefer'] = 'return=representation';
    } else if (options.update) {
      method = 'PATCH';
      body = JSON.stringify(options.update);
      headers['Prefer'] = 'return=representation';
    } else if (options.upsert) {
      method = 'POST';
      body = JSON.stringify(options.upsert);
      headers['Prefer'] = 'resolution=merge-duplicates,return=representation';
    }

    const response = await fetch(url, { method, headers, body });

    if (!response.ok) {
      const error = await response.text();

      // PGRST116 means 0 rows found with single: true - return null instead of throwing
      if (options.single && error.includes('PGRST116')) {
        return null;
      }

      console.error(`[Supabase] ${method} ${table} error: ${error}`);
      throw new Error(`Supabase error: ${error}`);
    }

    if (response.status === 204) {
      return null;
    }

    return response.json() as Promise<T>;
  }

  return {
    async upsertUserByEmail(user: { email: string; plan: 'free' | 'pro' }): Promise<SupabaseUser> {
      const result = await query<SupabaseUser[]>('users', {
        upsert: {
          email: user.email,
          plan: user.plan,
          github_id: null,
          username: null,
        },
        onConflict: 'email',
      });
      return result![0];
    },

    async getBlogBySubdomain(subdomain: string): Promise<SupabaseBlog | null> {
      return query<SupabaseBlog>('blogs', {
        select: '*',
        filter: { subdomain },
        single: true,
      });
    },

    async getBlogById(id: string): Promise<SupabaseBlog | null> {
      return query<SupabaseBlog>('blogs', {
        select: '*',
        filter: { id },
        single: true,
      });
    },

    async createBlog(blog: Omit<SupabaseBlog, 'id' | 'created_at' | 'updated_at'>): Promise<SupabaseBlog> {
      const result = await query<SupabaseBlog[]>('blogs', {
        insert: blog,
      });
      return result![0];
    },

    async updateBlog(id: string, updates: Partial<SupabaseBlog>): Promise<SupabaseBlog> {
      const result = await query<SupabaseBlog[]>('blogs', {
        filter: { id },
        update: { ...updates, updated_at: new Date().toISOString() },
      });
      return result![0];
    },

    async upsertPost(post: Omit<SupabasePost, 'id' | 'created_at'>): Promise<SupabasePost> {
      const result = await query<SupabasePost[]>('posts', {
        upsert: post,
        onConflict: 'blog_id,slug',
      });
      return result![0];
    },

    async getPostsByBlogId(blogId: string): Promise<SupabasePost[]> {
      const result = await query<SupabasePost[]>('posts', {
        select: '*',
        filter: { blog_id: blogId },
      });
      return result || [];
    },

    async deletePost(blogId: string, slug: string): Promise<void> {
      const url = `${supabaseUrl}/rest/v1/posts?blog_id=eq.${blogId}&slug=eq.${encodeURIComponent(slug)}`;
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
      });
      if (!response.ok) {
        const error = await response.text();
        console.error(`[Supabase] Delete post error: ${error}`);
        throw new Error(`Failed to delete post: ${error}`);
      }
    },

    async deleteBlog(id: string): Promise<void> {
      // Delete all posts first (in case there's no cascade)
      const postsUrl = `${supabaseUrl}/rest/v1/posts?blog_id=eq.${id}`;
      const postsResponse = await fetch(postsUrl, {
        method: 'DELETE',
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
      });
      if (!postsResponse.ok) {
        const error = await postsResponse.text();
        console.error(`[Supabase] Delete blog posts error: ${error}`);
        throw new Error(`Failed to delete blog posts: ${error}`);
      }

      const blogUrl = `${supabaseUrl}/rest/v1/blogs?id=eq.${id}`;
      const blogResponse = await fetch(blogUrl, {
        method: 'DELETE',
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
      });
      if (!blogResponse.ok) {
        const error = await blogResponse.text();
        console.error(`[Supabase] Delete blog error: ${error}`);
        throw new Error(`Failed to delete blog: ${error}`);
      }
    },
  };
}
