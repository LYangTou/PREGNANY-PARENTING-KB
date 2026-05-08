import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));

const nextConfig = {
  poweredByHeader: false,
  outputFileTracingRoot: projectRoot,
  outputFileTracingIncludes: {
    "/api/*": [
      "../cards/drafts/**/*.json",
      "../cards/drafts/**/*.md",
      "../cards/reviewed/**/*.json",
      "../cards/reviewed/**/*.md",
      "../schemas/**/*.json",
      "../sources/**/*.json"
    ]
  }
};

export default nextConfig;
