import { afterEach, describe, expect, it, vi } from "vitest";

const { createClient } = vi.hoisted(() => ({
  createClient: vi.fn(() => ({ from: vi.fn() })),
}));
vi.mock("@supabase/supabase-js", () => ({ createClient }));
vi.mock("@/integrations/supabase/mes-backend", () => ({}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  createClient.mockClear();
});

describe("shared MES privileged connection", () => {
  it("uses the MES secret without a managed service-role key", async () => {
    vi.stubEnv("SUPABASE_URL", "https://mes.example.invalid");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", undefined);
    vi.stubEnv("MES_SERVICE_ROLE_KEY", "test-mes-service-key");
    const { supabaseAdmin } = await import("./client.server");
    void supabaseAdmin.from;
    expect(createClient).toHaveBeenCalledWith(
      "https://mes.example.invalid",
      "test-mes-service-key",
      expect.objectContaining({ auth: expect.objectContaining({ persistSession: false }) }),
    );
  });

  it("keeps the managed service-role key as a fallback", async () => {
    vi.stubEnv("SUPABASE_URL", "https://mes.example.invalid");
    vi.stubEnv("MES_SERVICE_ROLE_KEY", undefined);
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-managed-service-key");
    const { supabaseAdmin } = await import("./client.server");
    void supabaseAdmin.from;
    expect(createClient).toHaveBeenCalledWith(
      "https://mes.example.invalid", "test-managed-service-key", expect.any(Object),
    );
  });
});