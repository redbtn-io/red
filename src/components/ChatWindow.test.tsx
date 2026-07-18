import { describe, it, expect, vi, afterEach } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/react";
import { ChatWindow } from "./ChatWindow.js";

afterEach(cleanup);

const theme = {
  primary: "#dc2626",
  background: "#fff",
  surface: "#f5f5f5",
  text: "#171717",
  textMuted: "#737373",
  border: "#e5e5e5",
  radius: "16px",
  fontFamily: "Inter",
};

function renderChatWindow(onClose: () => void) {
  // jsdom does not implement scrollIntoView; the auto-scroll effect calls it
  // on every mount.
  (HTMLElement.prototype as typeof HTMLElement.prototype & { scrollIntoView?: () => void }).scrollIntoView =
    vi.fn();

  return render(
    <ChatWindow
      messages={[]}
      isStreaming={false}
      onSend={() => {}}
      onClose={onClose}
      title="Red"
      placeholder="Ask..."
      theme={theme}
    />
  );
}

describe("ChatWindow keyboard close lifecycle", () => {
  it("closes the chat window on Escape", () => {
    const onClose = vi.fn();
    renderChatWindow(onClose);

    fireEvent.keyDown(window, { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("restores focus to the element that opened the window once it unmounts", () => {
    const trigger = document.createElement("button");
    trigger.setAttribute("aria-label", "Open Red");
    document.body.appendChild(trigger);
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    const onClose = vi.fn();
    const result = renderChatWindow(onClose);

    // Mounting moves focus into the message textarea (existing autofocus
    // behavior) — confirm that happened, then unmount as the real app does
    // when `open` flips to false, and assert focus returns to the trigger.
    expect(document.activeElement).not.toBe(trigger);

    result.unmount();

    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });

  it("removes the Escape listener once the window unmounts, so Escape no longer closes it", () => {
    const onClose = vi.fn();
    const result = renderChatWindow(onClose);

    result.unmount();
    fireEvent.keyDown(window, { key: "Escape" });

    expect(onClose).not.toHaveBeenCalled();
  });
});
