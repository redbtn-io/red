import { describe, it, expect, vi, afterEach } from "vitest";
import { render, fireEvent, screen, cleanup, act } from "@testing-library/react";
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

function renderChatWindow(onClose: () => void, onSend: (content: string) => void = () => {}) {
  // jsdom does not implement scrollIntoView; the auto-scroll effect calls it
  // on every mount.
  (HTMLElement.prototype as typeof HTMLElement.prototype & { scrollIntoView?: () => void }).scrollIntoView =
    vi.fn();

  return render(
    <ChatWindow
      messages={[]}
      isStreaming={false}
      onSend={onSend}
      onClose={onClose}
      title="Red"
      placeholder="Ask..."
      theme={theme}
    />
  );
}

describe("ChatWindow message/action submit guard", () => {
  it("does not send duplicate messages when the action is triggered twice in rapid succession", async () => {
    const resolvers: Array<() => void> = [];
    const onSend = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolvers.push(resolve);
        }),
    );
    renderChatWindow(() => {}, onSend);

    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "hello" } });
    const sendButton = screen.getByRole("button", { name: /send message/i });

    // Two rapid actions should only enqueue one send while the first is in-flight.
    await act(async () => {
      fireEvent.click(sendButton);
      fireEvent.click(sendButton);
    });
    expect(onSend).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolvers[0]?.();
      await Promise.resolve();
    });

    // After the first send settles, we can send again.
    fireEvent.change(textarea, { target: { value: "again" } });
    await act(async () => {
      fireEvent.click(sendButton);
    });
    expect(onSend).toHaveBeenCalledTimes(2);
  });
});

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

    const result = renderChatWindow(vi.fn());

    // Mounting moves focus into the message textarea (existing autofocus
    // behavior) — confirm that happened, then unmount as the real app does
    // when `open` flips to false, and assert focus returns to the trigger.
    expect(document.activeElement).not.toBe(trigger);

    result.unmount();

    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });

  it("keeps focus in the message textarea when onClose changes", () => {
    const trigger = document.createElement("button");
    document.body.appendChild(trigger);
    trigger.focus();

    const result = renderChatWindow(() => {});
    const textarea = screen.getByRole("textbox");
    expect(document.activeElement).toBe(textarea);

    result.rerender(
      <ChatWindow
        messages={[]}
        isStreaming={false}
        onSend={() => {}}
        onClose={() => {}}
        title="Red"
        placeholder="Ask..."
        theme={theme}
      />
    );

    expect(document.activeElement).toBe(textarea);
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
