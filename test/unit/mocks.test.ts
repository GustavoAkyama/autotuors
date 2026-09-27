import assert from "node:assert/strict";
import { test } from "node:test";
import {
  generalizeUrl,
  mocksFromResponses,
} from "../../src/mocks/from-responses.ts";
import { goesLive } from "../../src/mocks/live.ts";
import { urlPattern } from "../../src/mocks/replay.ts";

test("urlPattern: * casa um trecho do caminho e ** qualquer coisa", () => {
  const one = urlPattern("https://x.com/api/*/tweet");
  assert.ok(one.test("https://x.com/api/abc123/tweet"));
  assert.ok(!one.test("https://x.com/api/a/b/tweet"));
  assert.ok(urlPattern("https://x.com/api/**").test("https://x.com/api/a/b/c"));
  assert.ok(
    !urlPattern("https://x.com/api.json").test("https://x.com/apixjson"),
  );
});

test("generalizeUrl troca ids por * e tira a query", () => {
  assert.equal(
    generalizeUrl(
      "https://x.com/i/api/graphql/aB3dE5fG7hJ9kL1mN2/CreateTweet?v=1",
    ),
    "https://x.com/i/api/graphql/*/CreateTweet",
  );
  assert.equal(
    generalizeUrl("https://app.test/users/12345/posts"),
    "https://app.test/users/*/posts",
  );
  assert.equal(
    generalizeUrl("https://app.test/tasks"),
    "https://app.test/tasks",
  );
});

test("goesLive deixa login, tokens e conexões em tempo real irem ao site", () => {
  assert.ok(goesLive("https://app.test/api/auth/refresh"));
  assert.ok(goesLive("https://app.test/oauth2/token"));
  assert.ok(goesLive("https://app.test/socket.io/?EIO=4&transport=polling"));
  assert.ok(goesLive("https://app.test/hub/negotiate"));
  assert.ok(!goesLive("https://app.test/api/tasks"));
});

test("mocksFromResponses guarda cada corpo num arquivo de mocks/<nome>/", () => {
  const { mocks, bodies } = mocksFromResponses("post", [
    {
      method: "POST",
      url: "https://app.test/api/posts?draft=0",
      status: 201,
      headers: { "content-type": "application/json" },
      body: Buffer.from('{"id":1}'),
    },
    {
      method: "DELETE",
      url: "https://app.test/api/posts/98765",
      status: 204,
      headers: {},
      body: Buffer.alloc(0),
    },
  ]);
  assert.deepEqual(mocks, [
    {
      method: "POST",
      url: "https://app.test/api/posts",
      status: 201,
      headers: { "content-type": "application/json" },
      body: "mocks/post/01-posts.json",
    },
    {
      method: "DELETE",
      url: "https://app.test/api/posts/*",
      status: 204,
      headers: {},
      body: undefined,
    },
  ]);
  assert.deepEqual([...bodies.keys()], ["mocks/post/01-posts.json"]);
});
