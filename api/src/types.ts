export interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_KEY: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  JWT_SECRET: string;
  CF_API_TOKEN: string;
  CF_ACCOUNT_ID: string;
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
