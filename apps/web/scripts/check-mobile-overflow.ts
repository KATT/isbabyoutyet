import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { once } from "node:events";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { makeAsyncResource, makeResource } from "@workspace/convex/convex/test.resource";

const VIEWPORT_WIDTH = 393;
const VIEWPORT_HEIGHT = 924;
const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";

type PendingCommand = {
  resolve: (value: unknown) => void;
  reject: (cause: Error) => void;
};

type CdpMessage = {
  id?: number;
  result?: unknown;
  error?: { message: string };
};

type RuntimeResult<TResult> = {
  result: {
    value?: TResult;
  };
  exceptionDetails?: unknown;
};

type BrowserTarget = {
  webSocketDebuggerUrl?: string;
};

type OverflowResult = {
  documentWidth: number;
  viewportWidth: number;
  widest: {
    className: string;
    right: number;
    tagName: string;
  } | null;
};

type PageCheckOptions = {
  path: string;
  heading: string;
  expectedText: string | null;
};

class CdpClient {
  private nextId = 1;
  private readonly pending = new Map<number, PendingCommand>();

  constructor(private readonly socket: WebSocket) {
    socket.addEventListener("message", (event) => {
      this.handleMessage(String(event.data));
    });
  }

  send<TResult>(method: string, params: Record<string, unknown> = {}) {
    const id = this.nextId;
    this.nextId += 1;

    return new Promise<TResult>((resolve, reject) => {
      this.pending.set(id, {
        resolve: (value) => resolve(value as TResult),
        reject,
      });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  private handleMessage(rawMessage: string) {
    const message = JSON.parse(rawMessage) as CdpMessage;
    if (message.id === undefined) return;

    const pending = this.pending.get(message.id);
    if (!pending) return;
    this.pending.delete(message.id);

    if (message.error) {
      pending.reject(new Error(message.error.message));
      return;
    }
    pending.resolve(message.result);
  }
}

async function locateChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    "/usr/local/bin/google-chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter((candidate): candidate is string => !!candidate);

  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next common Chrome location.
    }
  }
  throw new Error("Chrome not found. Set CHROME_PATH to run the mobile overflow check.");
}

async function waitForDevtoolsPort(profileDirectory: string) {
  const portFile = join(profileDirectory, "DevToolsActivePort");
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const contents = await readFile(portFile, "utf8");
      const port = Number.parseInt(contents.split("\n")[0] ?? "", 10);
      if (Number.isFinite(port)) return port;
    } catch {
      await delay(50);
    }
  }
  throw new Error("Chrome did not expose a DevTools port");
}

async function connectToPage(port: number) {
  const response = await fetch(`http://127.0.0.1:${port}/json/list`);
  if (!response.ok) {
    throw new Error(`Chrome target request failed with ${response.status}`);
  }
  const targets = (await response.json()) as BrowserTarget[];
  const target = targets.find((candidate) => candidate.webSocketDebuggerUrl);
  if (!target?.webSocketDebuggerUrl) {
    throw new Error("Chrome did not expose a page target");
  }

  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise<void>((resolve, reject) => {
    socket.addEventListener("open", () => resolve(), { once: true });
    socket.addEventListener("error", () => reject(new Error("Chrome WebSocket failed")), {
      once: true,
    });
  });
  return socket;
}

async function evaluate<TResult>(client: CdpClient, expression: string) {
  const response = await client.send<RuntimeResult<TResult>>("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (response.exceptionDetails) {
    throw new Error(`Browser evaluation failed: ${JSON.stringify(response.exceptionDetails)}`);
  }
  return response.result.value as TResult;
}

async function waitForPage(client: CdpClient, options: PageCheckOptions) {
  const heading = JSON.stringify(options.heading);
  const expectedText = JSON.stringify(options.expectedText);
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const ready = await evaluate<boolean>(
      client,
      `document.readyState === "complete"
        && document.querySelector("h1")?.textContent?.includes(${heading}) === true
        && (${expectedText} === null || document.body.textContent?.includes(${expectedText}) === true)`,
    );
    if (ready) {
      await delay(250);
      return;
    }
    await delay(100);
  }
  throw new Error(`Page did not render expected content for "${options.heading}"`);
}

async function checkPage(client: CdpClient, options: PageCheckOptions) {
  await client.send("Page.navigate", { url: new URL(options.path, BASE_URL).href });
  await waitForPage(client, options);

  const result = await evaluate<OverflowResult>(
    client,
    `(() => {
      const viewportWidth = document.documentElement.clientWidth;
      const elements = [...document.querySelectorAll("body *")];
      const widest = elements
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            tagName: element.tagName,
            className: typeof element.className === "string" ? element.className : "",
            right: rect.right,
          };
        })
        .sort((left, right) => right.right - left.right)[0] ?? null;
      return {
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth,
        widest,
      };
    })()`,
  );

  if (result.documentWidth > result.viewportWidth) {
    throw new Error(
      `${options.path} overflows: ${result.documentWidth}px document in ${result.viewportWidth}px viewport; widest element ${JSON.stringify(result.widest)}`,
    );
  }
  console.log(`✓ ${options.path}: ${result.documentWidth}px ≤ ${result.viewportWidth}px`);
}

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function removeProfileDirectory(profileDirectory: string) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      await rm(profileDirectory, { recursive: true, force: true });
      return;
    } catch (error) {
      if (attempt === 9) throw error;
      await delay(50);
    }
  }
}

const profileDirectory = await mkdtemp(join(tmpdir(), "baby-overflow-"));
await using _profile = makeAsyncResource({}, async () => {
  await removeProfileDirectory(profileDirectory);
});

const chromePath = await locateChrome();
const chrome = spawn(
  chromePath,
  [
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    "--remote-debugging-port=0",
    `--user-data-dir=${profileDirectory}`,
    "about:blank",
  ],
  { stdio: "ignore" },
);
await using _chrome = makeAsyncResource({}, async () => {
  if (chrome.exitCode === null) {
    chrome.kill("SIGTERM");
    await once(chrome, "exit");
  }
});

const port = await waitForDevtoolsPort(profileDirectory);
const socket = await connectToPage(port);
using _socket = makeResource({}, () => socket.close());
const client = new CdpClient(socket);

await client.send("Page.enable");
await client.send("Runtime.enable");
await client.send("Emulation.setDeviceMetricsOverride", {
  width: VIEWPORT_WIDTH,
  height: VIEWPORT_HEIGHT,
  deviceScaleFactor: 1,
  mobile: true,
});

await checkPage(client, {
  path: "/baby/willow-brooks",
  heading: "Is Willow Brooks out yet?",
  expectedText: null,
});
await checkPage(client, {
  path: "/baby/baby-waiting",
  heading: "Is Baby Waiting out yet?",
  expectedText: null,
});
await checkPage(client, {
  path: "/baby/baby-born",
  heading: "Is Baby Born out yet?",
  expectedText: "layout-stress.example",
});
