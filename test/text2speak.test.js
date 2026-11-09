import test from "node:test";
import assert from "node:assert/strict";
import { createText2SpeakClient, parseTargets, validateTargets } from "../src/text2speak.js";

test("parseTargets supports comma-separated names, trims and removes duplicates", () => {
  assert.deepEqual(parseTargets(" Salon, cuisine, salon ,, "), ["salon", "cuisine"]);
});

test("parseTargets returns an empty array for an empty value", () => {
  assert.deepEqual(parseTargets("  "), []);
});

test("validateTargets accepts configured rooms and zones case-insensitively", () => {
  const layout = { pieces: { salon: {}, cuisine: {} }, zones: { maison: ["salon", "cuisine"] } };
  assert.doesNotThrow(() => validateTargets(["salon", "maison"], layout));
});

test("validateTargets rejects unknown targets", () => {
  const layout = { pieces: { salon: {} }, zones: {} };
  assert.throws(() => validateTargets(["garage"], layout), /garage/);
});

test("sendMessage sends Text2Speak API field names and returns job details", async () => {
  const calls = [];
  const fakeFetch = async (url, options = {}) => {
    calls.push({ url, options });
    if (url.endsWith("/pieces")) {
      return new Response(JSON.stringify({
        pieces: { salon: { serveur: "pi-salon" } },
        zones: { maison: ["salon"] },
        defaut: ["salon"]
      }), { status: 200 });
    }
    return new Response(JSON.stringify({
      OK: "Bonjour",
      id: 42,
      cibles: ["salon"],
      position: 2,
      en_cache: false
    }), { status: 202 });
  };

  const client = createText2SpeakClient({ fetchImpl: fakeFetch });
  const result = await client.sendMessage(
    { base_url: "http://tts.local:1337", timeout_seconds: 5 },
    { message: " Bonjour ", priority: 1, targets: "salon" }
  );

  assert.equal(result.job_id, "42");
  assert.equal(result.queue_position, 2);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].url, "http://tts.local:1337/dire");
  assert.deepEqual(JSON.parse(calls[1].options.body), {
    dire: "Bonjour",
    priorite: 1,
    cibles: ["salon"]
  });
});

test("sendMessage omits cibles when no target is entered (Text2Speak default)", async () => {
  let postedBody;
  const fakeFetch = async (_url, options = {}) => {
    postedBody = JSON.parse(options.body);
    return new Response(JSON.stringify({ id: 7, position: 1 }), { status: 202 });
  };

  const client = createText2SpeakClient({ fetchImpl: fakeFetch });
  await client.sendMessage(
    { base_url: "http://tts.local:1337", timeout_seconds: 5 },
    { message: "Test", priority: 5, targets: "" }
  );

  assert.deepEqual(postedBody, { dire: "Test", priorite: 5 });
});

test("sendMessage rejects a priority outside 0..9", async () => {
  const client = createText2SpeakClient();
  await assert.rejects(
    client.sendMessage(
      { base_url: "http://tts.local:1337" },
      { message: "Test", priority: 10 }
    ),
    /priorité/
  );
});
