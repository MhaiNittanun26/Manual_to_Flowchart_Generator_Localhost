import type { NextConfig } from "next";

// The app is served from a sub path so it can sit behind an nginx reverse
// proxy (`location /workflow-intelligence { proxy_pass http://127.0.0.1:PORT; }`).
// Override with BASE_PATH="" to serve from the domain root instead.
const basePath = process.env.BASE_PATH ?? "/workflow-intelligence";

const nextConfig: NextConfig = {
  basePath,
  // basePath is not applied to metadata/asset URLs written by hand, so expose
  // it to the app code that builds those paths.
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
};

export default nextConfig;
