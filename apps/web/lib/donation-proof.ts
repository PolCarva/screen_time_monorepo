const MAX_PROOF_BYTES = 5 * 1024 * 1024;

type ProofType = { extension: "pdf" | "png" | "jpg"; contentType: string };

function matches(bytes: Uint8Array, signature: number[]): boolean {
  return signature.every((value, index) => bytes[index] === value);
}

export async function validateDonationProof(
  value: FormDataEntryValue | null,
): Promise<ProofType> {
  if (!(value instanceof File) || value.size === 0)
    throw new Error("A donation proof file is required");
  if (value.size > MAX_PROOF_BYTES)
    throw new Error("Donation proof must be 5 MB or smaller");

  const bytes = new Uint8Array(await value.slice(0, 8).arrayBuffer());
  if (matches(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d]))
    return { extension: "pdf", contentType: "application/pdf" };
  if (matches(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    return { extension: "png", contentType: "image/png" };
  if (matches(bytes, [0xff, 0xd8, 0xff]))
    return { extension: "jpg", contentType: "image/jpeg" };
  throw new Error("Donation proof must be a PDF, PNG, or JPEG file");
}
