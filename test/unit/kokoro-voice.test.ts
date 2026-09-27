import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { voiceChoices, voiceIdOf } from "../../src/narration/choices.ts";
import { kokoro } from "../../src/narration/voices/kokoro.ts";
import { findTrack, tracks } from "../../src/video/music.ts";

test("o provedor kokoro espera o modelo carregar e salva o áudio", async () => {
  const requests: Record<string, unknown>[] = [];
  const server = http.createServer(async (request, response) => {
    let body = "";
    for await (const chunk of request) body += chunk;
    requests.push(JSON.parse(body));
    // The first call finds the model still loading.
    if (requests.length === 1)
      return response.writeHead(503, { "retry-after": "0" }).end();
    response.writeHead(200, { "content-type": "audio/wav" }).end("RIFF-fake");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  const output = path.join(os.tmpdir(), `voz-${process.pid}.wav`);
  try {
    const provider = kokoro({
      url: `http://127.0.0.1:${port}/v1/`,
      voice: "pm_alex",
    });
    await provider.synthesize("Olá!", output);
    assert.equal(fs.readFileSync(output, "utf8"), "RIFF-fake");
    assert.equal(requests.length, 2);
    assert.deepEqual(requests[1], {
      model: "kokoro",
      voice: "pm_alex",
      speed: 1,
      response_format: "wav",
      input: "Olá!",
    });
  } finally {
    server.close();
    fs.rmSync(output, { force: true });
  }
});

test("o provedor kokoro explica quando o servidor não está no ar", async () => {
  const provider = kokoro({ url: "http://127.0.0.1:9/v1" });
  await assert.rejects(
    provider.synthesize("Oi", path.join(os.tmpdir(), "nada.wav")),
    /docker run/,
  );
});

test("cada voz da lista é reconhecida pelo seu id", () => {
  for (const choice of voiceChoices)
    assert.equal(voiceIdOf(choice.voice), choice.id);
  assert.equal(voiceIdOf({ provider: "piper" }), "piper:pt_BR-faber-medium");
  assert.equal(voiceIdOf({ provider: "kokoro" }), "kokoro:pf_dora");
  assert.equal(voiceIdOf({ provider: "kokoro", voice: "af_bella" }), null);
});

test("cada música da lista tem licença e crédito", () => {
  assert.equal(new Set(tracks.map((track) => track.id)).size, tracks.length);
  for (const track of tracks) {
    assert.match(track.download, /^https:\/\//);
    assert.ok(track.credit.includes(track.title));
    assert.ok(track.license);
  }
  assert.equal(findTrack("nenhuma"), undefined);
});
