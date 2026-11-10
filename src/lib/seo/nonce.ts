import { headers } from "next/headers";

/** Read the middleware CSP nonce (for <script nonce> in RSC). */
export async function getNonce(): Promise<string | undefined> {
  try {
    const headersList = await headers();
    return headersList.get("x-nonce") ?? undefined;
  } catch {
    return undefined;
  }
}
