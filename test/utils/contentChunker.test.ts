import { describe, expect, test } from "bun:test";
import { splitByByteSize } from "../../src/utils/contentChunker";

describe("splitByByteSize", () => {
  test("returns empty array for empty string", () => {
    expect(splitByByteSize("", 8)).toEqual([]);
  });

  test("returns single chunk when content fits within maxBytes", () => {
    const input = "hello";
    expect(splitByByteSize(input, 8)).toEqual(["hello"]);
  });

  test("returns single chunk when content length equals maxBytes", () => {
    const input = "abcd";
    expect(splitByByteSize(input, 4)).toEqual(["abcd"]);
  });

  test("splits ASCII content into the expected number of chunks", () => {
    const input = "abcdefghij"; // 10 bytes
    const chunks = splitByByteSize(input, 4);
    expect(chunks).toEqual(["abcd", "efgh", "ij"]);
    expect(chunks.join("")).toBe(input);
  });

  test("never splits a multi-byte character across chunks", () => {
    const input = "あいう"; // each char is 3 UTF-8 bytes -> 9 bytes total
    const chunks = splitByByteSize(input, 4);
    // Only one 3-byte char fits per 4-byte chunk.
    expect(chunks).toEqual(["あ", "い", "う"]);
    for (const chunk of chunks) {
      expect(Buffer.byteLength(chunk, "utf8")).toBeLessThanOrEqual(4);
    }
    expect(chunks.join("")).toBe(input);
  });

  test("handles surrogate-pair emoji without breaking code points", () => {
    const input = "😀😀😀"; // each emoji is 4 UTF-8 bytes
    const chunks = splitByByteSize(input, 4);
    expect(chunks).toEqual(["😀", "😀", "😀"]);
    for (const chunk of chunks) {
      expect(Buffer.byteLength(chunk, "utf8")).toBeLessThanOrEqual(4);
    }
    expect(chunks.join("")).toBe(input);
  });

  test("preserves content exactly for long mixed input", () => {
    const input = `${"a".repeat(5000)}あ${"b".repeat(5000)}😀${"c".repeat(5000)}`;
    const maxBytes = 1024;
    const chunks = splitByByteSize(input, maxBytes);
    for (const chunk of chunks) {
      expect(Buffer.byteLength(chunk, "utf8")).toBeLessThanOrEqual(maxBytes);
    }
    expect(chunks.join("")).toBe(input);
  });

  test("emits a single chunk wider than maxBytes only when one char exceeds it", () => {
    // A single 4-byte char cannot fit in a 2-byte limit, but it must not be
    // dropped or split; it is emitted as its own chunk.
    const chunks = splitByByteSize("😀", 2);
    expect(chunks).toEqual(["😀"]);
  });
});
