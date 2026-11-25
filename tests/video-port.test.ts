// Repeat with: npx tsx --test tests/video-port.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { externalVideoFields, parseVideo, videoUrl } from "@kupragao/lms-core";
import { securityHeaders } from "../src/lib/security-headers";

test("a valid YouTube URL becomes a YouTube reference", () => {
  assert.deepEqual(parseVideo("https://youtu.be/abcdefghijk"), { videoSource: "YOUTUBE", videoRef: "abcdefghijk" });
  assert.deepEqual(parseVideo("https://www.youtube.com/watch?v=abcdefghijk"), { videoSource: "YOUTUBE", videoRef: "abcdefghijk" });
  assert.equal(videoUrl("YOUTUBE", "abcdefghijk", true), "https://www.youtube-nocookie.com/embed/abcdefghijk");
});

test("a valid Vimeo URL becomes a Vimeo reference", () => {
  assert.deepEqual(parseVideo("https://vimeo.com/123456"), { videoSource: "VIMEO", videoRef: "123456" });
  assert.deepEqual(parseVideo("https://player.vimeo.com/video/123456"), { videoSource: "VIMEO", videoRef: "123456" });
  assert.equal(videoUrl("VIMEO", "123456", true), "https://player.vimeo.com/video/123456");
});

test("an empty video field clears the reference and hides the player", () => {
  assert.deepEqual(externalVideoFields(""), { videoSource: null, videoRef: null });
  assert.equal(videoUrl(null, null, true), null);
});

test("a disallowed domain is rejected", () => {
  assert.equal(parseVideo("https://example.com/watch?v=abcdefghijk"), null);
  assert.equal(externalVideoFields("https://example.com/watch?v=abcdefghijk"), null);
});

test("a malformed URL is rejected", () => {
  assert.equal(parseVideo("not a url"), null);
  assert.equal(externalVideoFields("not a url"), null);
});

test("a non-https, credentialed, or port-qualified URL is rejected", () => {
  assert.equal(parseVideo("http://youtu.be/abcdefghijk"), null);
  assert.equal(parseVideo("javascript:alert(1)"), null);
  assert.equal(parseVideo("https://user:secret@youtu.be/abcdefghijk"), null);
  assert.equal(parseVideo("https://youtu.be:8443/abcdefghijk"), null);
  assert.equal(externalVideoFields("http://youtu.be/abcdefghijk"), null);
  assert.equal(externalVideoFields("https://www.youtube.com:8443/watch?v=abcdefghijk"), null);
});

test("replacing the video keeps the lesson id and progress", () => {
  const lesson = { id: "item-1", progress: { positionSec: 9 } };
  const replaced = { ...lesson, ...externalVideoFields("https://vimeo.com/42") };
  assert.equal(replaced.id, "item-1");
  assert.deepEqual(replaced.progress, { positionSec: 9 });
  assert.equal(replaced.videoSource, "VIMEO");
  assert.equal(replaced.videoRef, "42");
});

test("clearing the video keeps the lesson id and progress", () => {
  const lesson = { id: "item-1", progress: { positionSec: 9 }, videoSource: "YOUTUBE" as const, videoRef: "abcdefghijk" };
  const cleared = { ...lesson, ...externalVideoFields("") };
  assert.equal(cleared.id, lesson.id);
  assert.deepEqual(cleared.progress, lesson.progress);
  assert.equal(cleared.videoSource, null);
  assert.equal(cleared.videoRef, null);
});

test("embed hosts stay on the existing frame-src allowlist", () => {
  const policy = securityHeaders("production").find((header) => header.key === "Content-Security-Policy")?.value ?? "";
  assert.match(policy, /frame-src 'self' https:\/\/www\.youtube-nocookie\.com https:\/\/player\.vimeo\.com/);
  assert.equal(policy.includes("example.com"), false);
});
