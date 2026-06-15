/**
 * Split content into chunks not exceeding maxBytes (UTF-8 byte count),
 * never breaking a Unicode code point across chunks.
 *
 * Content shorter than maxBytes is returned as a single chunk, so short
 * input keeps the previous behavior of being sent in one shot.
 */
export function splitByByteSize(content: string, maxBytes: number): string[] {
  if (content === "") {
    return [];
  }

  const chunks: string[] = [];
  let current = "";
  let currentBytes = 0;

  // Iterate by code point so multi-byte characters are never split.
  for (const char of content) {
    const charBytes = Buffer.byteLength(char, "utf8");
    if (current !== "" && currentBytes + charBytes > maxBytes) {
      chunks.push(current);
      current = "";
      currentBytes = 0;
    }
    current += char;
    currentBytes += charBytes;
  }

  if (current !== "") {
    chunks.push(current);
  }

  return chunks;
}
