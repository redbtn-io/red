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

describe("ChatWindow message/action submit guard", () => {
  it("does not send duplicate messages when the action is triggered twice in rapid succession", async () => {
    (HTMLElement.prototype as typeof HTMLElement.prototype & { scrollIntoView?: () => void }).scrollIntoView =
      vi.fn();

    const resolvers: Array<() => void> = [];
    const onSend = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolvers.push(resolve);
        }),
    );

    render(
      <ChatWindow
        messages={[]}
        isStreaming={false}
        onSend={onSend}
        onClose={() => {}}
        title="Red"
        placeholder="Ask..."
        theme={theme}
      />
    );

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
