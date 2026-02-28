interface Env {
  BLOG_CONTENT: KVNamespace;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const hostname = url.hostname;

    // Extract subdomain from hostname (e.g., "myblog" from "myblog.postt.io")
    let subdomain: string;

    if (hostname.endsWith('.postt.io')) {
      subdomain = hostname.replace('.postt.io', '');
    } else if (hostname === 'localhost' || hostname.includes('workers.dev')) {
      // For testing - use query param or default
      subdomain = url.searchParams.get('subdomain') || 'test';
    } else {
      // Custom domain - look up mapping
      const mapping = await env.BLOG_CONTENT.get(`domain:${hostname}`);
      if (mapping) {
        subdomain = mapping;
      } else {
        return new Response('Blog not found', { status: 404 });
      }
    }

    // Normalize path
    let path = url.pathname;
    if (path === '/') {
      path = '/index.html';
    } else if (!path.endsWith('.html') && !path.includes('.')) {
      // /my-post -> /my-post/index.html
      path = path.endsWith('/') ? `${path}index.html` : `${path}/index.html`;
    }

    // Fetch content from KV
    // Key format: blog:{subdomain}:{path}
    const key = `blog:${subdomain}:${path}`;
    const content = await env.BLOG_CONTENT.get(key);

    if (!content) {
      // Try without trailing index.html for backwards compat
      const altKey = `blog:${subdomain}:/index.html`;
      const altContent = await env.BLOG_CONTENT.get(altKey);

      if (altContent && path === '/index.html') {
        return new Response(altContent, {
          headers: {
            'Content-Type': 'text/html;charset=UTF-8',
            'Cache-Control': 'public, max-age=60',
          },
        });
      }

      return new Response(`Page not found: ${subdomain}${path}`, { status: 404 });
    }

    return new Response(content, {
      headers: {
        'Content-Type': 'text/html;charset=UTF-8',
        'Cache-Control': 'public, max-age=60',
      },
    });
  },
};
