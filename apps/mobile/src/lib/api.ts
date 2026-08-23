import { z } from "zod";

import { ensureAnonymousSession } from "@/lib/supabase";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

export async function apiFetch<T>(path: string, schema: z.ZodType<T>, init?: RequestInit): Promise<T> {
  const response = await apiRequest(path, init);
  return schema.parse(await response.json());
}

export async function apiRequest(path: string, init?: RequestInit): Promise<Response> {
  const session = await ensureAnonymousSession();
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      accept: "application/json",
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...(session ? { authorization: `Bearer ${session.access_token}` } : {}),
      ...init?.headers,
    },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`API ${response.status}: ${body.slice(0, 180)}`);
  }
  return response;
}
