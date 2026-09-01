// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BetaSignupForm } from "./beta-signup-form";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("BetaSignupForm", () => {
  it("persists the request and resets the submitted form after the async response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    render(<BetaSignupForm />);

    const email = screen.getByLabelText("Email");
    expect(screen.getByText("Android")).toBeInTheDocument();
    const consent = screen.getByRole("checkbox", {
      name: "Acepto recibir novedades sobre la beta privada.",
    });

    fireEvent.change(email, { target: { value: "person@example.com" } });
    fireEvent.click(consent);
    fireEvent.submit(email.closest("form")!);

    expect(
      await screen.findByText("Solicitud registrada. Te contactaremos por email."),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/beta/waitlist",
      expect.objectContaining({ method: "POST" }),
    );

    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(request.body))).toMatchObject({
      email: "person@example.com",
      platform: "android",
      consent: true,
      company: "",
    });
    expect(email).toHaveValue("");
    expect(consent).not.toBeChecked();
  });
});
