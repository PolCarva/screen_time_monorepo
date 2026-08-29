from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "brand" / "v3" / "qa"
OUT.mkdir(parents=True, exist_ok=True)
BASE = "http://localhost:3000"


def inspect(page, name: str, width: int, height: int):
    console_errors: list[str] = []
    page_errors: list[str] = []
    page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
    page.on("pageerror", lambda error: page_errors.append(str(error)))
    page.set_viewport_size({"width": width, "height": height})
    page.goto(BASE, wait_until="networkidle")
    page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
    page.wait_for_timeout(500)
    page.evaluate("window.scrollTo(0, 0)")
    page.wait_for_timeout(150)
    page.screenshot(path=str(OUT / f"web-home-{name}.png"), full_page=True)
    metrics = page.evaluate(
        """() => ({
          title: document.title,
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
          h1: document.querySelector('h1')?.textContent?.trim(),
          factCount: document.querySelectorAll('.hero-v3__facts > div').length,
          fieldModules: document.querySelectorAll('.field i').length,
          images: Array.from(document.images).map(img => ({src: img.currentSrc, complete: img.complete, width: img.naturalWidth})),
          cta: document.querySelector('#beta-status')?.textContent?.trim().slice(0, 80),
        })"""
    )
    assert metrics["scrollWidth"] == metrics["clientWidth"], f"horizontal overflow: {metrics}"
    assert metrics["factCount"] == 4, metrics
    assert metrics["fieldModules"] >= 60, metrics
    assert all(image["complete"] and image["width"] > 0 for image in metrics["images"]), metrics
    assert "segundo" in (metrics["h1"] or "").lower(), metrics
    assert metrics["cta"], metrics
    return metrics, console_errors, page_errors


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    desktop = browser.new_page()
    desktop_metrics, desktop_console, desktop_page = inspect(desktop, "desktop", 1440, 1000)
    desktop.get_by_role("link", name="Impacto", exact=True).first.click()
    desktop.wait_for_load_state("networkidle")
    desktop.screenshot(path=str(OUT / "web-impact-desktop.png"), full_page=True)
    assert "/impact" in desktop.url
    assert desktop.locator(".impact-ledger").count() == 1

    mobile = browser.new_page()
    mobile_metrics, mobile_console, mobile_page = inspect(mobile, "mobile", 390, 844)
    browser.close()

    errors = desktop_console + desktop_page + mobile_console + mobile_page
    print({
        "desktop": desktop_metrics,
        "mobile": mobile_metrics,
        "errors": errors,
        "screenshots": [
            str(OUT / "web-home-desktop.png"),
            str(OUT / "web-home-mobile.png"),
            str(OUT / "web-impact-desktop.png"),
        ],
    })
    if errors:
        raise AssertionError(errors)
