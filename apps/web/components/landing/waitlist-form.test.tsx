// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WaitlistForm } from "./waitlist-form";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("WaitlistForm", () => {
  it("sends the chosen platform and resets after the response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    render(<WaitlistForm />);

    const email = screen.getByLabelText("Correo");
    expect(screen.getByRole("radio", { name: "Los dos" })).toBeChecked();
    fireEvent.click(screen.getByRole("radio", { name: "iPhone" }));
    const consent = screen.getByRole("checkbox", {
      name: "Acepto recibir un correo cuando Still esté publicada.",
    });
    fireEvent.change(email, { target: { value: "person@example.com" } });
    fireEvent.click(consent);
    fireEvent.submit(email.closest("form")!);

    expect(
      await screen.findByText("Listo. Te escribimos una sola vez, cuando esté publicada."),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/beta/waitlist",
      expect.objectContaining({ method: "POST" }),
    );
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(request.body))).toMatchObject({
      email: "person@example.com",
      platform: "ios",
      consent: true,
      company: "",
    });
    expect(email).toHaveValue("");
    expect(consent).not.toBeChecked();
  });

  it("says so when the request fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    render(<WaitlistForm />);
    fireEvent.change(screen.getByLabelText("Correo"), {
      target: { value: "person@example.com" },
    });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.submit(screen.getByLabelText("Correo").closest("form")!);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No pudimos guardar tu correo.",
    );
  });
});
