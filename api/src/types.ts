export interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_KEY: string;
  JWT_SECRET: string;
  APP_URL: string;
  SESSIONS: KVNamespace;
  BLOG_CONTENT: KVNamespace;
}

export interface User {
  id: string;
  username: string;
  email: string;
}

export interface Variables {
  user?: User;
}
