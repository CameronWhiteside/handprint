import { describe, it, expect } from "vitest";
import { sanitize, sanitizeObject } from "../../src/sanitizer/sanitize.js";

describe("sanitize", () => {
  describe("email redaction", () => {
    it("redacts simple emails", () => {
      expect(sanitize("contact alice@example.com for details")).toBe(
        "contact [REDACTED_EMAIL] for details",
      );
    });

    it("redacts multiple emails", () => {
      expect(sanitize("from bob@test.org to carol@dev.io")).toBe(
        "from [REDACTED_EMAIL] to [REDACTED_EMAIL]",
      );
    });

    it("redacts emails with special chars", () => {
      expect(sanitize("user.name+tag@sub.domain.co.uk")).toBe("[REDACTED_EMAIL]");
    });
  });

  describe("API key patterns", () => {
    it("redacts ALL_CAPS key identifiers (name and value)", () => {
      // The value-aware pass now redacts the value too, then the KEY_CASE pass
      // redacts the name.
      expect(sanitize("set CLOUDFLARE_API_TOKEN=xyz")).toBe(
        "set [REDACTED_KEY]=[REDACTED_VALUE]",
      );
    });

    it("redacts SECRET and PASSWORD variants", () => {
      expect(sanitize("use DB_SECRET_KEY and AUTH_PASSWORD")).toBe(
        "use [REDACTED_KEY] and [REDACTED_KEY]",
      );
    });

    it("redacts TOKEN identifiers", () => {
      expect(sanitize("export OAUTH_TOKEN here")).toBe(
        "export [REDACTED_KEY] here",
      );
    });
  });

  describe("key-like flags", () => {
    it("redacts hyphenated key flags", () => {
      expect(sanitize("pass --api-key value")).toBe("pass --[REDACTED_KEY] value");
    });

    it("redacts token and secret flags", () => {
      expect(sanitize("use auth-token and db-secret")).toBe(
        "use [REDACTED_KEY] and [REDACTED_KEY]",
      );
    });

    it("redacts password flags", () => {
      expect(sanitize("set user-password=abc")).toBe("set [REDACTED_KEY]=abc");
    });

    it("redacts api-prefixed flags", () => {
      expect(sanitize("the api-endpoint is here")).toBe(
        "the [REDACTED_KEY] is here",
      );
    });
  });

  describe("mixed alphanumeric tokens", () => {
    it("redacts hash-like strings", () => {
      expect(sanitize("commit abc12def34")).toBe("commit [REDACTED_TOKEN]");
    });

    it("redacts long credential-like tokens", () => {
      expect(sanitize("token: sk2aB3cD4eF5")).toBe("token: [REDACTED_TOKEN]");
    });

    it("does not redact short strings", () => {
      expect(sanitize("the abc1 variable")).toBe("the abc1 variable");
    });

    it("does not redact pure letters", () => {
      expect(sanitize("the function returns")).toBe("the function returns");
    });

    it("does not redact pure numbers", () => {
      expect(sanitize("port 8080 is open")).toBe("port 8080 is open");
    });
  });

  describe("URL auth params", () => {
    it("redacts token query params", () => {
      expect(sanitize("https://api.example.com?token=abc123xyz")).toContain(
        "token=[REDACTED_TOKEN]",
      );
    });

    it("redacts key query params", () => {
      expect(sanitize("https://api.example.com?key=secret123&foo=bar")).toContain(
        "key=[REDACTED_TOKEN]",
      );
    });

    it("redacts password query params", () => {
      expect(sanitize("https://db.host?password=hunter2&db=main")).toContain(
        "password=[REDACTED_TOKEN]",
      );
    });
  });

  describe("normal text passes through", () => {
    it("leaves plain text untouched", () => {
      expect(sanitize("Chose React over Vue for the frontend")).toBe(
        "Chose React over Vue for the frontend",
      );
    });

    it("leaves technical text untouched", () => {
      expect(sanitize("Deploy to production on Friday")).toBe(
        "Deploy to production on Friday",
      );
    });

    it("leaves short identifiers alone", () => {
      expect(sanitize("v2 is ready")).toBe("v2 is ready");
    });
  });
});

describe("sanitize, item 6 additions", () => {
  describe("PEM key blocks", () => {
    it("redacts a PEM private key block", () => {
      const pem = "-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA1234567890abcdef\n-----END RSA PRIVATE KEY-----";
      const result = sanitize(`context ${pem} end`);
      expect(result).toContain("[REDACTED_PEM]");
      expect(result).not.toContain("MIIEowIBAAKCAQEA");
    });

    it("redacts a PEM certificate block", () => {
      const pem = "-----BEGIN CERTIFICATE-----\nABCDEFGHIJKLMNOP\n-----END CERTIFICATE-----";
      const result = sanitize(pem);
      expect(result).toContain("[REDACTED_PEM]");
      expect(result).not.toContain("ABCDEFGHIJKLMNOP");
    });
  });

  describe("known token prefixes", () => {
    it("redacts a Slack bot token (xoxb-)", () => {
      const result = sanitize("token is xoxb-123-456-abc");
      expect(result).toContain("[REDACTED_TOKEN]");
      expect(result).not.toContain("xoxb-123");
    });

    it("redacts a Stripe live secret key (sk_live_)", () => {
      const result = sanitize("use sk_live_abc123xyz for payments");
      expect(result).toContain("[REDACTED_TOKEN]");
      expect(result).not.toContain("sk_live_");
    });

    it("redacts a Stripe test publishable key (pk_test_)", () => {
      const result = sanitize("pk_test_AbCdEfGhIj is the public key");
      expect(result).toContain("[REDACTED_TOKEN]");
      expect(result).not.toContain("pk_test_");
    });

    it("redacts a GitHub PAT (ghp_) when used standalone", () => {
      // Test the standalone token, when embedded in KEY=value context, the
      // value-aware pass catches the value first and emits [REDACTED_VALUE].
      const result = sanitize("auth with ghp_AbCdEfGhIjKlMnOpQrStUvWxYz123456 token");
      expect(result).toContain("[REDACTED_TOKEN]");
      expect(result).not.toContain("ghp_");
    });
  });

  describe("value-aware key=value assignment", () => {
    it("redacts the value in API_KEY=<value>", () => {
      const result = sanitize("API_KEY=sk_live_abc123");
      expect(result).toContain("[REDACTED_VALUE]");
      expect(result).not.toContain("sk_live_abc123");
    });

    it("redacts value in DATABASE_PASSWORD=hunter2", () => {
      const result = sanitize("DATABASE_PASSWORD=hunter2");
      expect(result).toContain("[REDACTED_VALUE]");
      expect(result).not.toContain("hunter2");
    });

    it("redacts value in colon-separated form STRIPE_SECRET: abc123", () => {
      const result = sanitize("STRIPE_SECRET: abc123xyz");
      expect(result).toContain("[REDACTED_VALUE]");
      expect(result).not.toContain("abc123xyz");
    });
  });
});

describe("sanitizeObject", () => {
  it("sanitizes all string values recursively", () => {
    const obj = {
      intent: "email alice@test.com about the deploy",
      risk: "CLOUDFLARE_API_TOKEN might leak",
      nested: {
        context: "auth-token was exposed",
        count: 42,
      },
    };
    const result = sanitizeObject(obj);
    expect(result.intent).toBe("email [REDACTED_EMAIL] about the deploy");
    expect(result.risk).toBe("[REDACTED_KEY] might leak");
    expect((result.nested as Record<string, unknown>).context).toBe(
      "[REDACTED_KEY] was exposed",
    );
    expect((result.nested as Record<string, unknown>).count).toBe(42);
  });

  it("sanitizes strings inside arrays", () => {
    const obj = {
      items: ["alice@test.com", "normal text", 123],
    };
    const result = sanitizeObject(obj);
    expect((result.items as unknown[])[0]).toBe("[REDACTED_EMAIL]");
    expect((result.items as unknown[])[1]).toBe("normal text");
    expect((result.items as unknown[])[2]).toBe(123);
  });

  it("handles null and undefined values", () => {
    const obj = {
      a: null,
      b: undefined,
      c: "alice@test.com",
    };
    const result = sanitizeObject(obj);
    expect(result.a).toBeNull();
    expect(result.b).toBeUndefined();
    expect(result.c).toBe("[REDACTED_EMAIL]");
  });
});
