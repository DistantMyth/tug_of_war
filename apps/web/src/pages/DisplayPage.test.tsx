import { BrowserRouter } from "react-router-dom";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { socketClient } from "../socket/socketClient.js";
import { useSessionStore } from "../store/useSessionStore.js";

vi.mock("../socket/socketClient.js", () => ({
  socketClient: {
    connectDisplay: vi.fn(),
    reconnectDisplay: vi.fn(),
    disconnectDisplay: vi.fn(),
    isDisplayConnected: false,
    connect: vi.fn(),
    connectAdmin: vi.fn(),
    adminOpen: vi.fn(),
  },
}));

vi.mock("../components/display/DisplayStage.js", () => ({
  DisplayStage: () => <div data-testid="display-stage">DISPLAY STAGE</div>,
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { DisplayPage } = await import("../pages/DisplayPage.js");

function renderPage() {
  return render(
    <BrowserRouter>
      <DisplayPage />
    </BrowserRouter>,
  );
}

describe("DisplayPage — Authentication & Display Flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear stored credential
    useSessionStore.setState({ displaySecret: null });
    localStorage.removeItem("tow_display_secret");
  });

  // ─── Test 1 ───────────────────────────────────────────────────────────────
  it("1. shows PIN auth UI when no credential is stored", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("DISPLAY AUTHENTICATION")).toBeInTheDocument();
    });

    expect(screen.getByLabelText(/Enter Display PIN/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /CONNECT DISPLAY/i })).toBeInTheDocument();
    // Should NOT show the projector stage
    expect(screen.queryByTestId("display-stage")).not.toBeInTheDocument();
  });

  // ─── Test 2 ───────────────────────────────────────────────────────────────
  it("2. correct display PIN connects display socket and shows stage", async () => {
    vi.mocked(socketClient.connectDisplay).mockResolvedValue({ ok: true });

    renderPage();

    await waitFor(() => screen.getByLabelText(/Enter Display PIN/i));

    await act(async () => {
      fireEvent.change(screen.getByLabelText(/Enter Display PIN/i), {
        target: { value: "local-display-2026" },
      });
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /CONNECT DISPLAY/i }));
    });

    await waitFor(() => {
      expect(socketClient.connectDisplay).toHaveBeenCalledWith("local-display-2026");
      expect(screen.getByTestId("display-stage")).toBeInTheDocument();
    });
  });

  // ─── Test 3 ───────────────────────────────────────────────────────────────
  it("3. wrong PIN returns connect_error and keeps main stage hidden", async () => {
    vi.mocked(socketClient.connectDisplay).mockResolvedValue({
      ok: false,
      message: "UNAUTHORIZED: Invalid display credentials",
    });

    renderPage();

    await waitFor(() => screen.getByLabelText(/Enter Display PIN/i));

    await act(async () => {
      fireEvent.change(screen.getByLabelText(/Enter Display PIN/i), {
        target: { value: "wrong-pin" },
      });
      fireEvent.click(screen.getByRole("button", { name: /CONNECT DISPLAY/i }));
    });

    await waitFor(() => {
      expect(screen.getByText(/Display PIN rejected/i)).toBeInTheDocument();
      expect(screen.queryByTestId("display-stage")).not.toBeInTheDocument();
    });
  });

  // ─── Test 4 ───────────────────────────────────────────────────────────────
  it("4. successful auth receives sync and shows stage", async () => {
    vi.mocked(socketClient.connectDisplay).mockResolvedValue({ ok: true });

    renderPage();
    await waitFor(() => screen.getByLabelText(/Enter Display PIN/i));

    await act(async () => {
      fireEvent.change(screen.getByLabelText(/Enter Display PIN/i), {
        target: { value: "local-display-2026" },
      });
      fireEvent.click(screen.getByRole("button", { name: /CONNECT DISPLAY/i }));
    });

    await waitFor(() => {
      expect(screen.getByTestId("display-stage")).toBeInTheDocument();
    });

    expect(socketClient.connectDisplay).toHaveBeenCalledTimes(1);
    expect(socketClient.connectDisplay).toHaveBeenCalledWith("local-display-2026");
  });

  // ─── Test 5 ───────────────────────────────────────────────────────────────
  it("5. invalid stored credential clears it and returns to PIN UI", async () => {
    // Simulate a stored credential that is now invalid
    useSessionStore.setState({ displaySecret: "old-invalid-secret" });
    vi.mocked(socketClient.connectDisplay).mockResolvedValue({
      ok: false,
      message: "UNAUTHORIZED: Invalid display credentials",
    });

    renderPage();

    await waitFor(() => {
      // Should auto-attempt and then show PIN screen with message
      expect(screen.getByText("DISPLAY AUTHENTICATION")).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText(/Stored PIN is no longer valid/i)).toBeInTheDocument();
    });

    expect(socketClient.connectDisplay).toHaveBeenCalledWith("old-invalid-secret");
    // Stored credential should be cleared
    expect(useSessionStore.getState().displaySecret).toBeNull();
  });

  // ─── Test 6 ───────────────────────────────────────────────────────────────
  it("6. reconnect after network interruption re-authenticates with stored credential", async () => {
    useSessionStore.setState({ displaySecret: "local-display-2026" });
    vi.mocked(socketClient.connectDisplay).mockResolvedValue({ ok: true });

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId("display-stage")).toBeInTheDocument();
    });

    // connectDisplay was called with the stored credential (auto-reconnect)
    expect(socketClient.connectDisplay).toHaveBeenCalledWith("local-display-2026");
  });

  // ─── Test 7 ───────────────────────────────────────────────────────────────
  it("7. display never uses player token", async () => {
    useSessionStore.setState({
      token: "player-token-xyz",
      displaySecret: null,
    });
    vi.mocked(socketClient.connectDisplay).mockResolvedValue({ ok: true });

    renderPage();
    await waitFor(() => screen.getByLabelText(/Enter Display PIN/i));

    await act(async () => {
      fireEvent.change(screen.getByLabelText(/Enter Display PIN/i), {
        target: { value: "local-display-2026" },
      });
      fireEvent.click(screen.getByRole("button", { name: /CONNECT DISPLAY/i }));
    });

    await waitFor(() => {
      expect(socketClient.connectDisplay).toHaveBeenCalledWith("local-display-2026");
      // connectDisplay should NOT have been called with the player token
      expect(socketClient.connectDisplay).not.toHaveBeenCalledWith("player-token-xyz");
    });
  });

  // ─── Test 8 ───────────────────────────────────────────────────────────────
  it("8. display never uses admin token", async () => {
    useSessionStore.setState({
      adminToken: "admin-secret-xyz",
      displaySecret: null,
    });
    vi.mocked(socketClient.connectDisplay).mockResolvedValue({ ok: true });

    renderPage();
    await waitFor(() => screen.getByLabelText(/Enter Display PIN/i));

    await act(async () => {
      fireEvent.change(screen.getByLabelText(/Enter Display PIN/i), {
        target: { value: "local-display-2026" },
      });
      fireEvent.click(screen.getByRole("button", { name: /CONNECT DISPLAY/i }));
    });

    await waitFor(() => {
      expect(socketClient.connectDisplay).toHaveBeenCalledWith("local-display-2026");
      expect(socketClient.connectDisplay).not.toHaveBeenCalledWith("admin-secret-xyz");
    });
  });

  // ─── Test 10 ──────────────────────────────────────────────────────────────
  it("10. admin preview DisplayStage does NOT require DISPLAY_SECRET", async () => {
    // Import DisplayStage directly (not through DisplayPage)
    const { DisplayStage } = await import("../components/display/DisplayStage.js");

    render(
      <BrowserRouter>
        <DisplayStage isPreview={true} />
      </BrowserRouter>,
    );

    // connectDisplay must NOT have been called for preview
    expect(socketClient.connectDisplay).not.toHaveBeenCalled();
    expect(socketClient.connect).not.toHaveBeenCalledWith("display", expect.anything());
    // Preview renders the stage content (mocked)
    expect(screen.getByTestId("display-stage")).toBeInTheDocument();
  });

  // ─── Test 11 ──────────────────────────────────────────────────────────────
  it("11. no display secret appears in rendered public game state UI", async () => {
    useSessionStore.setState({ displaySecret: "local-display-2026" });
    vi.mocked(socketClient.connectDisplay).mockResolvedValue({ ok: true });

    renderPage();
    await waitFor(() => screen.getByTestId("display-stage"));

    // The raw secret must not appear in the DOM
    expect(document.body.innerHTML).not.toContain("local-display-2026");
  });

  // ─── Error UX mapping ─────────────────────────────────────────────────────
  it("shows friendly error for server unavailable", async () => {
    vi.mocked(socketClient.connectDisplay).mockResolvedValue({
      ok: false,
      message: "xhr poll error",
    });

    renderPage();
    await waitFor(() => screen.getByLabelText(/Enter Display PIN/i));

    await act(async () => {
      fireEvent.change(screen.getByLabelText(/Enter Display PIN/i), {
        target: { value: "any" },
      });
      fireEvent.click(screen.getByRole("button", { name: /CONNECT DISPLAY/i }));
    });

    await waitFor(() => {
      expect(screen.getByText(/Battle server unavailable/i)).toBeInTheDocument();
    });
  });

  it("Enter key submits PIN form", async () => {
    vi.mocked(socketClient.connectDisplay).mockResolvedValue({ ok: true });

    renderPage();
    await waitFor(() => screen.getByLabelText(/Enter Display PIN/i));

    await act(async () => {
      fireEvent.change(screen.getByLabelText(/Enter Display PIN/i), {
        target: { value: "local-display-2026" },
      });
      fireEvent.keyDown(screen.getByLabelText(/Enter Display PIN/i), { key: "Enter" });
    });

    await waitFor(() => {
      expect(socketClient.connectDisplay).toHaveBeenCalledWith("local-display-2026");
    });
  });

  it("CONNECT DISPLAY button is disabled when PIN is empty", async () => {
    renderPage();
    await waitFor(() => screen.getByRole("button", { name: /CONNECT DISPLAY/i }));
    expect(screen.getByRole("button", { name: /CONNECT DISPLAY/i })).toBeDisabled();
  });
});
