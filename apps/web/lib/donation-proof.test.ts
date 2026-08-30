import { describe, expect, it } from "vitest";

import { validateDonationProof } from "./donation-proof";

describe("donation proof validation", () => {
  it("recognizes content from its signature instead of the client MIME type", async () => {
    const file = new File(
      [new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31])],
      "proof.txt",
      { type: "text/plain" },
    );
    await expect(validateDonationProof(file)).resolves.toEqual({
      extension: "pdf",
      contentType: "application/pdf",
    });
  });

  it("rejects empty and unsupported files", async () => {
    await expect(
      validateDonationProof(new File([], "empty.pdf")),
    ).rejects.toThrow("required");
    await expect(
      validateDonationProof(
        new File(["not an image"], "fake.png", { type: "image/png" }),
      ),
    ).rejects.toThrow("PDF, PNG, or JPEG");
  });
});
