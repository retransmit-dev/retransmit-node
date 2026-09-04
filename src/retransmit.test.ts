import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Retransmit } from "./retransmit";
import { createClient, onlyRequest, stubFetch, TEST_API_KEY, useCleanEnv } from "./test-utils";

useCleanEnv();

const packageJson = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as { version: string };

describe("constructor", () => {
  it("accepts an explicit API key", () => {
    expect(() => new Retransmit(TEST_API_KEY)).not.toThrow();
  });

  it("falls back to RETRANSMIT_API_KEY", async () => {
    process.env.RETRANSMIT_API_KEY = "rt_from_env";
    const calls = stubFetch({ body: { id: "em_1" } });

    await new Retransmit().emails.get("em_1");

    expect(onlyRequest(calls).headers.Authorization).toBe("Bearer rt_from_env");
  });

  it("prefers the explicit key over the environment", async () => {
    process.env.RETRANSMIT_API_KEY = "rt_from_env";
    const calls = stubFetch({ body: {} });

    await new Retransmit("rt_explicit").emails.get("em_1");

    expect(onlyRequest(calls).headers.Authorization).toBe("Bearer rt_explicit");
  });

  it("throws a message naming the env var when no key is available", () => {
    expect(() => new Retransmit()).toThrowError(/RETRANSMIT_API_KEY/);
  });
});

describe("base URL", () => {
  it("defaults to the production API", async () => {
    const calls = stubFetch({ body: {} });
    await createClient().emails.get("em_1");
    expect(onlyRequest(calls).url.origin).toBe("https://api.retransmit.dev");
  });

  it("honours the baseUrl option", async () => {
    const calls = stubFetch({ body: {} });
    await createClient({ baseUrl: "http://localhost:3002" }).emails.get("em_1");
    expect(onlyRequest(calls).url.origin).toBe("http://localhost:3002");
  });

  it("falls back to RETRANSMIT_BASE_URL", async () => {
    process.env.RETRANSMIT_BASE_URL = "https://staging.example.com";
    const calls = stubFetch({ body: {} });

    await createClient().emails.get("em_1");

    expect(onlyRequest(calls).url.origin).toBe("https://staging.example.com");
  });

  it("prefers the option over the environment", async () => {
    process.env.RETRANSMIT_BASE_URL = "https://staging.example.com";
    const calls = stubFetch({ body: {} });

    await createClient({ baseUrl: "http://localhost:3002" }).emails.get("em_1");

    expect(onlyRequest(calls).url.origin).toBe("http://localhost:3002");
  });

  it("strips trailing slashes so paths never double up", async () => {
    const calls = stubFetch({ body: {} });
    await createClient({ baseUrl: "http://localhost:3002///" }).emails.get("em_1");
    expect(onlyRequest(calls).url.href).toBe("http://localhost:3002/v1/emails/em_1");
  });
});

describe("request headers", () => {
  it("sends the API key as a bearer token with a JSON content type", async () => {
    const calls = stubFetch({ body: {} });

    await createClient().emails.send({ from: "a@x.com", to: "b@x.com", subject: "s", text: "t" });

    const request = onlyRequest(calls);
    expect(request.headers.Authorization).toBe(`Bearer ${TEST_API_KEY}`);
    expect(request.headers["Content-Type"]).toBe("application/json");
  });

  it("identifies itself with a User-Agent matching the published version", async () => {
    const calls = stubFetch({ body: {} });

    await createClient().emails.get("em_1");

    // The version in the User-Agent is hardcoded in retransmit.ts. This fails
    // when package.json is bumped and that constant is not.
    expect(onlyRequest(calls).headers["User-Agent"]).toBe(
      `retransmit.dev-node/${packageJson.version}`,
    );
  });
});

describe("query serialisation", () => {
  it("omits undefined values", async () => {
    const calls = stubFetch({ body: {} });

    await createClient().request("GET", "/v1/emails", undefined, {
      status: "sent",
      cursor: undefined,
    });

    expect(onlyRequest(calls).url.search).toBe("?status=sent");
  });

  it("repeats a key for each item in an array", async () => {
    const calls = stubFetch({ body: {} });

    await createClient().request("GET", "/v1/emails", undefined, {
      tag: ["campaign:spring", "category:receipt"],
    });

    expect(onlyRequest(calls).url.searchParams.getAll("tag")).toEqual([
      "campaign:spring",
      "category:receipt",
    ]);
  });

  it("sends no query string when every value is undefined", async () => {
    const calls = stubFetch({ body: {} });

    await createClient().request("GET", "/v1/emails", undefined, { status: undefined });

    expect(onlyRequest(calls).url.search).toBe("");
  });

  it("keeps numeric zero rather than treating it as absent", async () => {
    const calls = stubFetch({ body: {} });

    await createClient().request("GET", "/v1/emails", undefined, { limit: 0 });

    expect(onlyRequest(calls).url.searchParams.get("limit")).toBe("0");
  });
});

describe("request body", () => {
  it("omits the body on GET requests", async () => {
    const calls = stubFetch({ body: {} });
    await createClient().emails.get("em_1");
    expect(onlyRequest(calls).body).toBeUndefined();
  });

  it("percent-encodes ids in the path", async () => {
    const calls = stubFetch({ body: {} });
    await createClient().emails.get("em_/../secret");
    expect(onlyRequest(calls).url.pathname).toBe("/v1/emails/em_%2F..%2Fsecret");
  });
});

describe("response handling", () => {
  it("returns the parsed body on success", async () => {
    stubFetch({ body: { id: "em_123" } });

    const result = await createClient().emails.send({
      from: "a@x.com",
      to: "b@x.com",
      subject: "s",
      text: "t",
    });

    expect(result).toEqual({ data: { id: "em_123" }, error: null });
  });

  it("returns the API error envelope on a failure status", async () => {
    stubFetch({
      status: 422,
      body: { error: { code: "validation_error", message: "subject is required" } },
    });

    const { data, error } = await createClient().emails.send({
      from: "a@x.com",
      to: "b@x.com",
      subject: "",
      text: "t",
    });

    expect(data).toBeNull();
    expect(error).toEqual({ code: "validation_error", message: "subject is required" });
  });

  it("synthesises an error when a failure carries no envelope", async () => {
    stubFetch({ status: 500, body: {} });

    const { error } = await createClient().emails.get("em_1");

    expect(error).toEqual({ code: "internal_error", message: "Request failed with status 500" });
  });

  it("survives a non-JSON failure body, such as a proxy error page", async () => {
    stubFetch({ status: 502, raw: "<html>Bad Gateway</html>" });

    const { data, error } = await createClient().emails.get("em_1");

    expect(data).toBeNull();
    expect(error).toEqual({ code: "internal_error", message: "Request failed with status 502" });
  });

  it("reports a transport failure as network_error without throwing", async () => {
    stubFetch({ networkError: "getaddrinfo ENOTFOUND api.retransmit.dev" });

    const { data, error } = await createClient().emails.get("em_1");

    expect(data).toBeNull();
    expect(error?.code).toBe("network_error");
    expect(error?.message).toBe("getaddrinfo ENOTFOUND api.retransmit.dev");
  });

  it("never throws on an API error, only on a missing key", async () => {
    stubFetch({ status: 401, body: { error: { code: "unauthorized", message: "bad key" } } });

    await expect(createClient().emails.get("em_1")).resolves.toMatchObject({
      error: { code: "unauthorized" },
    });
  });
});
