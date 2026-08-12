import { fireEvent, render, screen } from "@testing-library/react";
import { useMutation } from "convex/react";
import { getFunctionName } from "convex/server";
import { toast } from "sonner";
import { expect, test, vi } from "vitest";
import {
  BabyBornMessageEditor,
  DueDateEditor,
  HospitalMessageEditor,
  LaborStartedMessageEditor,
  NameEditor,
  PhotoUploader,
  StatusDateEditor,
  StatusUpdateButton,
  ThemeSelector,
} from "./editors";
import { makeBaby, renderResource } from "./test-helpers";
import type { Id } from "@workspace/convex/convex/_generated/dataModel";
import { makeResource } from "@workspace/convex/convex/test.resource";

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("convex/react", () => ({
  useMutation: vi.fn(),
}));

const BABY_ID = "baby-1" as Id<"baby">;

// Base UI popovers don't reliably reopen in the same jsdom render, so every
// test performs a single open -> interact -> close cycle on a fresh render.

test("DueDateEditor saves a changed date", async () => {
  const onUpdate = vi.fn(async () => {});
  await using view = renderResource(
    render(<DueDateEditor baby={makeBaby({ dueDate: "2026-09-01" })} onUpdate={onUpdate} />),
  );

  fireEvent.click(view.getByRole("button", { name: "Edit" }));
  const input = await screen.findByDisplayValue("2026-09-01");
  fireEvent.change(input, { target: { value: "2026-09-15" } });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));

  await vi.waitFor(() => {
    expect(onUpdate).toHaveBeenCalledWith({ dueDate: expect.stringContaining("2026-09-1") });
  });
});

test("DueDateEditor cancel resets the draft without saving", async () => {
  const onUpdate = vi.fn(async () => {});
  await using view = renderResource(
    render(<DueDateEditor baby={makeBaby({ dueDate: "2026-09-01" })} onUpdate={onUpdate} />),
  );

  fireEvent.click(view.getByRole("button", { name: "Edit" }));
  fireEvent.change(await screen.findByDisplayValue("2026-09-01"), {
    target: { value: "2026-10-01" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(onUpdate).not.toHaveBeenCalled();
});

test("DueDateEditor surfaces update failures as a toast", async () => {
  const onUpdate = vi.fn(async () => {
    throw new Error("Update failed");
  });
  await using view = renderResource(
    render(<DueDateEditor baby={makeBaby({ dueDate: "2026-09-01" })} onUpdate={onUpdate} />),
  );

  fireEvent.click(view.getByRole("button", { name: "Edit" }));
  fireEvent.change(await screen.findByDisplayValue("2026-09-01"), {
    target: { value: "2026-09-15" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));

  await vi.waitFor(() => {
    expect(toast.error).toHaveBeenCalledWith("Update failed");
  });
});

test.each([
  ["labor_started", "laborStarted"],
  ["gone_to_hospital", "wentToHospital"],
  ["born", "babyBorn"],
] as const)("StatusDateEditor saves a %s date", async (status, field) => {
  const onUpdate = vi.fn(async () => {});
  await using view = renderResource(
    render(
      <StatusDateEditor
        baby={makeBaby({})}
        status={status}
        currentDate="2026-08-10T08:00:00.000Z"
        onUpdate={onUpdate}
      />,
    ),
  );

  fireEvent.click(view.getByRole("button", { name: "Edit" }));
  const input = await screen.findByDisplayValue(/2026-08-10T/);
  fireEvent.change(input, { target: { value: "2026-08-11T09:30" } });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));

  await vi.waitFor(() => {
    expect(onUpdate).toHaveBeenCalledWith({ [field]: expect.stringContaining("2026-08-11") });
  });
});

test("StatusDateEditor cancel resets the draft without saving", async () => {
  const onUpdate = vi.fn(async () => {});
  await using view = renderResource(
    render(
      <StatusDateEditor
        baby={makeBaby({})}
        status="born"
        currentDate="2026-08-10T08:00:00.000Z"
        onUpdate={onUpdate}
      />,
    ),
  );

  fireEvent.click(view.getByRole("button", { name: "Edit" }));
  fireEvent.change(await screen.findByDisplayValue(/2026-08-10T/), {
    target: { value: "2026-08-11T09:30" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(onUpdate).not.toHaveBeenCalled();
});

test("StatusDateEditor surfaces update failures as a toast", async () => {
  const onUpdate = vi.fn(async () => {
    throw new Error("Nope");
  });
  await using view = renderResource(
    render(
      <StatusDateEditor
        baby={makeBaby({})}
        status="born"
        currentDate="2026-08-10T08:00:00.000Z"
        onUpdate={onUpdate}
      />,
    ),
  );

  fireEvent.click(view.getByRole("button", { name: "Edit" }));
  fireEvent.change(await screen.findByDisplayValue(/2026-08-10T/), {
    target: { value: "2026-08-11T09:30" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await vi.waitFor(() => {
    expect(toast.error).toHaveBeenCalledWith("Nope");
  });
});

test("NameEditor saves via the save button", async () => {
  const onUpdate = vi.fn(async () => {});
  await using view = renderResource(
    render(<NameEditor baby={makeBaby({ name: "Old Name" })} onUpdate={onUpdate} />),
  );

  fireEvent.click(view.getByRole("button", { name: "Edit" }));
  const input = await screen.findByPlaceholderText("Baby name");
  fireEvent.change(input, { target: { value: "New Name" } });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));

  await vi.waitFor(() => {
    expect(onUpdate).toHaveBeenCalledWith({ name: "New Name" });
  });
});

test("NameEditor saves via the Enter key", async () => {
  const onUpdate = vi.fn(async () => {});
  await using view = renderResource(
    render(<NameEditor baby={makeBaby({ name: "Old Name" })} onUpdate={onUpdate} />),
  );

  fireEvent.click(view.getByRole("button", { name: "Edit" }));
  const input = await screen.findByPlaceholderText("Baby name");
  fireEvent.change(input, { target: { value: "Enter Name" } });
  fireEvent.keyDown(input, { key: "Enter" });

  await vi.waitFor(() => {
    expect(onUpdate).toHaveBeenCalledWith({ name: "Enter Name" });
  });
});

test("NameEditor resets via Escape without saving", async () => {
  const onUpdate = vi.fn(async () => {});
  await using view = renderResource(
    render(<NameEditor baby={makeBaby({ name: "Old Name" })} onUpdate={onUpdate} />),
  );

  fireEvent.click(view.getByRole("button", { name: "Edit" }));
  const input = await screen.findByPlaceholderText("Baby name");
  fireEvent.change(input, { target: { value: "Escaped" } });
  fireEvent.keyDown(input, { key: "Escape" });
  expect(onUpdate).not.toHaveBeenCalled();
});

test("NameEditor resets via Cancel without saving", async () => {
  const onUpdate = vi.fn(async () => {});
  await using view = renderResource(
    render(<NameEditor baby={makeBaby({ name: "Old Name" })} onUpdate={onUpdate} />),
  );

  fireEvent.click(view.getByRole("button", { name: "Edit" }));
  const input = await screen.findByPlaceholderText("Baby name");
  fireEvent.change(input, { target: { value: "Cancelled" } });
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(onUpdate).not.toHaveBeenCalled();
});

test("NameEditor surfaces update failures as a toast", async () => {
  const onUpdate = vi.fn(async () => {
    throw new Error("Name rejected");
  });
  await using view = renderResource(
    render(<NameEditor baby={makeBaby({ name: "Old" })} onUpdate={onUpdate} />),
  );

  fireEvent.click(view.getByRole("button", { name: "Edit" }));
  const input = await screen.findByPlaceholderText("Baby name");
  fireEvent.change(input, { target: { value: "New" } });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await vi.waitFor(() => {
    expect(toast.error).toHaveBeenCalledWith("Name rejected");
  });
});

const MESSAGE_EDITORS = [
  [
    "hospital",
    HospitalMessageEditor,
    "Do not disturb, only send messages to the parents",
    "hospitalMessage",
  ],
  [
    "labor",
    LaborStartedMessageEditor,
    "Custom message to show when labour has started",
    "laborStartedMessage",
  ],
  ["born", BabyBornMessageEditor, "Custom message to show when baby is born", "babyBornMessage"],
] as const;

test.each(MESSAGE_EDITORS)(
  "%s message editor saves a trimmed message",
  async (_label, Editor, placeholder, field) => {
    const onUpdate = vi.fn(async () => {});
    await using view = renderResource(render(<Editor baby={makeBaby({})} onUpdate={onUpdate} />));

    fireEvent.click(view.getByRole("button", { name: "Edit" }));
    const textarea = await screen.findByPlaceholderText(placeholder);
    fireEvent.change(textarea, { target: { value: "  A message  " } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await vi.waitFor(() => {
      expect(onUpdate).toHaveBeenCalledWith({ [field]: "A message" });
    });
  },
);

test.each(MESSAGE_EDITORS)(
  "%s message editor clears the message when emptied",
  async (_label, Editor, placeholder, field) => {
    const onUpdate = vi.fn(async () => {});
    await using view = renderResource(
      render(<Editor baby={makeBaby({ [field]: "Existing" })} onUpdate={onUpdate} />),
    );

    fireEvent.click(view.getByRole("button", { name: "Edit" }));
    const textarea = await screen.findByPlaceholderText(placeholder);
    fireEvent.change(textarea, { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await vi.waitFor(() => {
      expect(onUpdate).toHaveBeenCalledWith({ [field]: null });
    });
  },
);

test.each(MESSAGE_EDITORS)(
  "%s message editor cancel resets the draft without saving",
  async (_label, Editor, placeholder, field) => {
    const onUpdate = vi.fn(async () => {});
    await using view = renderResource(
      render(<Editor baby={makeBaby({ [field]: "Existing" })} onUpdate={onUpdate} />),
    );

    fireEvent.click(view.getByRole("button", { name: "Edit" }));
    fireEvent.change(await screen.findByPlaceholderText(placeholder), {
      target: { value: "Draft" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onUpdate).not.toHaveBeenCalled();
  },
);

test.each(MESSAGE_EDITORS)(
  "%s message editor failures surface as a toast",
  async (_label, Editor, placeholder) => {
    const onUpdate = vi.fn(async () => {
      throw new Error("Message rejected");
    });
    await using view = renderResource(render(<Editor baby={makeBaby({})} onUpdate={onUpdate} />));

    fireEvent.click(view.getByRole("button", { name: "Edit" }));
    fireEvent.change(await screen.findByPlaceholderText(placeholder), {
      target: { value: "Hello" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await vi.waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Message rejected");
    });
  },
);

test.each(MESSAGE_EDITORS)(
  "%s message editor shows a generic message for non-Error failures",
  async (label, Editor, placeholder) => {
    const onUpdate = vi.fn(async () => {
      // eslint-disable-next-line no-throw-literal
      throw "boom";
    });
    await using view = renderResource(render(<Editor baby={makeBaby({})} onUpdate={onUpdate} />));

    fireEvent.click(view.getByRole("button", { name: "Edit" }));
    fireEvent.change(await screen.findByPlaceholderText(placeholder), {
      target: { value: "Hello" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await vi.waitFor(() => {
      const expected = {
        hospital: "Failed to update hospital message",
        labor: "Failed to update labour message",
        born: "Failed to update baby born message",
      }[label];
      expect(toast.error).toHaveBeenCalledWith(expected);
    });
  },
);

test("StatusDateEditor shows a generic message for non-Error failures", async () => {
  const onUpdate = vi.fn(async () => {
    // eslint-disable-next-line no-throw-literal
    throw "boom";
  });
  await using view = renderResource(
    render(
      <StatusDateEditor
        baby={makeBaby({})}
        status="born"
        currentDate="2026-08-10T08:00:00.000Z"
        onUpdate={onUpdate}
      />,
    ),
  );

  fireEvent.click(view.getByRole("button", { name: "Edit" }));
  fireEvent.change(await screen.findByDisplayValue(/2026-08-10T/), {
    target: { value: "2026-08-11T09:30" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await vi.waitFor(() => {
    expect(toast.error).toHaveBeenCalledWith("Failed to update status date");
  });
});

test.each([
  [new Error("Enter rejected"), "Enter rejected"],
  ["boom", "Failed to update name"],
] as const)("NameEditor surfaces Enter-key failures (%s)", async (thrown, expected) => {
  const onUpdate = vi.fn(async () => {
    throw thrown;
  });
  await using view = renderResource(
    render(<NameEditor baby={makeBaby({ name: "Old" })} onUpdate={onUpdate} />),
  );

  fireEvent.click(view.getByRole("button", { name: "Edit" }));
  const input = await screen.findByPlaceholderText("Baby name");
  fireEvent.change(input, { target: { value: "New" } });
  fireEvent.keyDown(input, { key: "Enter" });
  await vi.waitFor(() => {
    expect(toast.error).toHaveBeenCalledWith(expected);
  });
});

test("ThemeSelector updates the theme", async () => {
  const onUpdate = vi.fn(async () => {});
  await using view = renderResource(
    render(<ThemeSelector baby={makeBaby({})} onUpdate={onUpdate} />),
  );

  fireEvent.click(view.getByRole("button", { name: "Change" }));
  fireEvent.click(await screen.findByRole("button", { name: /Twitter Blue/ }));
  await vi.waitFor(() => {
    expect(onUpdate).toHaveBeenCalledWith({ theme: "twitter" });
  });
});

test("ThemeSelector surfaces failures as a toast", async () => {
  const onUpdate = vi.fn(async () => {
    throw new Error("Theme rejected");
  });
  await using view = renderResource(
    render(<ThemeSelector baby={makeBaby({})} onUpdate={onUpdate} />),
  );

  fireEvent.click(view.getByRole("button", { name: "Change" }));
  fireEvent.click(await screen.findByRole("button", { name: /Bubblegum/ }));
  await vi.waitFor(() => {
    expect(toast.error).toHaveBeenCalledWith("Theme rejected");
  });
});

test.each([
  ["labor_started", "laborStarted"],
  ["gone_to_hospital", "wentToHospital"],
  ["born", "babyBorn"],
] as const)("StatusUpdateButton marks %s with the current time", async (status, field) => {
  const onUpdate = vi.fn(async () => {});
  await using view = renderResource(
    render(
      <StatusUpdateButton
        baby={makeBaby({})}
        status={status}
        currentStatus={null}
        label="The label"
        icon={null}
        isNextState
        onUpdate={onUpdate}
      />,
    ),
  );
  fireEvent.click(view.getByRole("button", { name: "Mark as The label" }));
  await vi.waitFor(() => {
    expect(onUpdate).toHaveBeenCalledWith({ [field]: expect.any(String) });
  });
});

test.each([
  ["labor_started", "laborStarted"],
  ["gone_to_hospital", "wentToHospital"],
  ["born", "babyBorn"],
] as const)("StatusUpdateButton unmarks %s", async (status, field) => {
  const onUpdate = vi.fn(async () => {});
  await using view = renderResource(
    render(
      <StatusUpdateButton
        baby={makeBaby({})}
        status={status}
        currentStatus="2026-08-10T08:00:00.000Z"
        label="The label"
        icon={null}
        isNextState={false}
        onUpdate={onUpdate}
      />,
    ),
  );
  fireEvent.click(view.getByRole("button", { name: "Unmark The label" }));
  await vi.waitFor(() => {
    expect(onUpdate).toHaveBeenCalledWith({ [field]: null });
  });
});

test("StatusUpdateButton surfaces failures as a toast", async () => {
  const onUpdate = vi.fn(async () => {
    throw new Error("Status rejected");
  });
  await using view = renderResource(
    render(
      <StatusUpdateButton
        baby={makeBaby({})}
        status="born"
        currentStatus={null}
        label="Baby born"
        icon={null}
        isNextState
        onUpdate={onUpdate}
      />,
    ),
  );
  fireEvent.click(view.getByRole("button", { name: "Mark as Baby born" }));
  await vi.waitFor(() => {
    expect(toast.error).toHaveBeenCalledWith("Status rejected");
  });
});

test("editors show a generic message when the failure is not an Error", async () => {
  const onUpdate = vi.fn(async () => {
    // eslint-disable-next-line no-throw-literal
    throw "boom";
  });

  {
    await using view = renderResource(
      render(<DueDateEditor baby={makeBaby({ dueDate: "2026-09-01" })} onUpdate={onUpdate} />),
    );
    fireEvent.click(view.getByRole("button", { name: "Edit" }));
    fireEvent.change(await screen.findByDisplayValue("2026-09-01"), {
      target: { value: "2026-09-15" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await vi.waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to update due date");
    });
  }

  {
    await using view = renderResource(
      render(<NameEditor baby={makeBaby({ name: "Old" })} onUpdate={onUpdate} />),
    );
    fireEvent.click(view.getByRole("button", { name: "Edit" }));
    fireEvent.change(await screen.findByPlaceholderText("Baby name"), {
      target: { value: "New" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await vi.waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to update name");
    });
  }

  {
    await using view = renderResource(
      render(<HospitalMessageEditor baby={makeBaby({})} onUpdate={onUpdate} />),
    );
    fireEvent.click(view.getByRole("button", { name: "Edit" }));
    fireEvent.change(
      await screen.findByPlaceholderText("Do not disturb, only send messages to the parents"),
      { target: { value: "Hello" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await vi.waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to update hospital message");
    });
  }

  {
    await using view = renderResource(
      render(<ThemeSelector baby={makeBaby({})} onUpdate={onUpdate} />),
    );
    fireEvent.click(view.getByRole("button", { name: "Change" }));
    fireEvent.click(await screen.findByRole("button", { name: /Twitter Blue/ }));
    await vi.waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to update theme");
    });
  }

  {
    await using view = renderResource(
      render(
        <StatusUpdateButton
          baby={makeBaby({})}
          status="born"
          currentStatus={null}
          label="Baby born"
          icon={null}
          isNextState
          onUpdate={onUpdate}
        />,
      ),
    );
    fireEvent.click(view.getByRole("button", { name: "Mark as Baby born" }));
    await vi.waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to update status date");
    });
  }
});

test("message editors highlight the edit button while their status is active", async () => {
  const onUpdate = vi.fn(async () => {});

  // RTL render-result queries are bound to document.body, so render one at a time
  {
    await using hospital = renderResource(
      render(
        <HospitalMessageEditor
          baby={makeBaby({
            laborStarted: "2026-08-10T08:00:00.000Z",
            wentToHospital: "2026-08-10T09:00:00.000Z",
          })}
          onUpdate={onUpdate}
        />,
      ),
    );
    expect(hospital.getByRole("button", { name: "Edit" })).toBeTruthy();
  }
  {
    await using labor = renderResource(
      render(
        <LaborStartedMessageEditor
          baby={makeBaby({ laborStarted: "2026-08-10T08:00:00.000Z" })}
          onUpdate={onUpdate}
        />,
      ),
    );
    expect(labor.getByRole("button", { name: "Edit" })).toBeTruthy();
  }
  {
    await using born = renderResource(
      render(
        <BabyBornMessageEditor
          baby={makeBaby({ babyBorn: "2026-08-11T09:00:00.000Z" })}
          onUpdate={onUpdate}
        />,
      ),
    );
    expect(born.getByRole("button", { name: "Edit" })).toBeTruthy();
  }
});

test("DueDateEditor closes on outside press unless the date picker has focus", async () => {
  const onUpdate = vi.fn(async () => {});
  await using view = renderResource(
    render(<DueDateEditor baby={makeBaby({ dueDate: "2026-09-01" })} onUpdate={onUpdate} />),
  );

  fireEvent.click(view.getByRole("button", { name: "Edit" }));
  const input = await screen.findByDisplayValue("2026-09-01");

  // While the native date input is focused, outside presses keep it open
  input.focus();
  fireEvent.pointerDown(document.body);
  fireEvent.mouseDown(document.body);
  expect(screen.queryByDisplayValue("2026-09-01")).toBeTruthy();

  // Once focus moves away, an outside press closes the popover
  (input as HTMLInputElement).blur();
  fireEvent.pointerDown(document.body);
  fireEvent.mouseDown(document.body);
  fireEvent.click(document.body);
  await vi.waitFor(() => {
    expect(screen.queryByDisplayValue("2026-09-01")).toBeNull();
  });
});

test("StatusUpdateButton renders as outline when completed even if next", async () => {
  const onUpdate = vi.fn(async () => {});
  await using view = renderResource(
    render(
      <StatusUpdateButton
        baby={makeBaby({})}
        status="born"
        currentStatus="2026-08-10T08:00:00.000Z"
        label="Baby born"
        icon={null}
        isNextState
        onUpdate={onUpdate}
      />,
    ),
  );
  expect(view.getByRole("button", { name: "Unmark Baby born" })).toBeTruthy();
});

test("PhotoUploader shows the uploading state while an upload is in flight", async () => {
  await using mocks = usePhotoUploaderMocks();
  // Keep the upload hanging so the intermediate state is observable
  mocks.generateUploadUrlMock.mockReturnValueOnce(new Promise(() => {}) as never);

  await using view = renderResource(
    render(<PhotoUploader babyId={BABY_ID} photoUrl="https://example.com/photo.jpg" />),
  );
  fireEvent.click(view.getByRole("button", { name: "Change" }));
  await screen.findByRole("button", { name: /Replace/ });

  selectFile(new File(["img"], "baby.png", { type: "image/png" }));

  expect(await screen.findByText("Uploading...")).toBeTruthy();
});

test("NameEditor ignores Enter without changes and other keys", async () => {
  const onUpdate = vi.fn(async () => {});
  await using view = renderResource(
    render(<NameEditor baby={makeBaby({ name: "Same Name" })} onUpdate={onUpdate} />),
  );

  fireEvent.click(view.getByRole("button", { name: "Edit" }));
  const input = await screen.findByPlaceholderText("Baby name");
  fireEvent.keyDown(input, { key: "Enter" });
  fireEvent.keyDown(input, { key: "a" });
  expect(onUpdate).not.toHaveBeenCalled();
});

function usePhotoUploaderMocks() {
  const generateUploadUrlMock = vi.fn(async () => "https://upload.example.com");
  const updatePhotoMock = vi.fn(async () => null);
  vi.mocked(useMutation).mockImplementation(
    (ref) =>
      (getFunctionName(ref) === "baby:generateUploadUrl"
        ? generateUploadUrlMock
        : updatePhotoMock) as never,
  );

  vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: vi.fn(() => "blob:preview") }));
  const fetchMock = vi.fn(async () => ({
    ok: true,
    json: async () => ({ storageId: "storage-123" }),
  }));
  vi.stubGlobal("fetch", fetchMock);

  return makeResource({ generateUploadUrlMock, updatePhotoMock, fetchMock }, () => {
    vi.unstubAllGlobals();
  });
}

function selectFile(file: File) {
  const input = document.body.querySelector('input[type="file"]');
  if (!input) throw new Error("file input not found");
  fireEvent.change(input, { target: { files: [file] } });
}

test("PhotoUploader uploads an image and saves the storage id", async () => {
  await using mocks = usePhotoUploaderMocks();
  await using view = renderResource(render(<PhotoUploader babyId={BABY_ID} photoUrl={null} />));

  fireEvent.click(view.getByRole("button", { name: "Add" }));
  await screen.findByRole("button", { name: /Upload/ });

  selectFile(new File(["img"], "baby.png", { type: "image/png" }));

  await vi.waitFor(() => {
    expect(mocks.updatePhotoMock).toHaveBeenCalledWith({ babyId: BABY_ID, photoId: "storage-123" });
  });
  expect(mocks.generateUploadUrlMock).toHaveBeenCalledWith({ babyId: BABY_ID });
  expect(toast.success).toHaveBeenCalledWith("Photo uploaded successfully");
});

test("PhotoUploader rejects non-image files", async () => {
  await using mocks = usePhotoUploaderMocks();
  await using view = renderResource(render(<PhotoUploader babyId={BABY_ID} photoUrl={null} />));

  fireEvent.click(view.getByRole("button", { name: "Add" }));
  await screen.findByRole("button", { name: /Upload/ });

  selectFile(new File(["nope"], "notes.txt", { type: "text/plain" }));

  await vi.waitFor(() => {
    expect(toast.error).toHaveBeenCalledWith("Please select an image file");
  });
  expect(mocks.generateUploadUrlMock).not.toHaveBeenCalled();
});

test("PhotoUploader surfaces upload failures", async () => {
  await using mocks = usePhotoUploaderMocks();
  mocks.fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({}) } as never);

  await using view = renderResource(render(<PhotoUploader babyId={BABY_ID} photoUrl={null} />));
  fireEvent.click(view.getByRole("button", { name: "Add" }));
  await screen.findByRole("button", { name: /Upload/ });

  selectFile(new File(["img"], "baby.png", { type: "image/png" }));

  await vi.waitFor(() => {
    expect(toast.error).toHaveBeenCalledWith("Failed to upload image");
  });
});

function clickRemoveButton() {
  const trashIcon = document.body.querySelector("svg.lucide-trash-2");
  const removeButton = trashIcon?.closest("button");
  if (!removeButton) throw new Error("remove button not found");
  fireEvent.click(removeButton);
}

test("PhotoUploader removes an existing photo", async () => {
  await using mocks = usePhotoUploaderMocks();
  await using view = renderResource(
    render(<PhotoUploader babyId={BABY_ID} photoUrl="https://example.com/photo.jpg" />),
  );

  fireEvent.click(view.getByRole("button", { name: "Change" }));
  await screen.findByRole("button", { name: /Replace/ });
  clickRemoveButton();

  await vi.waitFor(() => {
    expect(mocks.updatePhotoMock).toHaveBeenCalledWith({ babyId: BABY_ID, photoId: null });
  });
  expect(toast.success).toHaveBeenCalledWith("Photo removed");
});

test("PhotoUploader ignores an empty file selection", async () => {
  await using mocks = usePhotoUploaderMocks();
  await using view = renderResource(render(<PhotoUploader babyId={BABY_ID} photoUrl={null} />));

  fireEvent.click(view.getByRole("button", { name: "Add" }));
  await screen.findByRole("button", { name: /Upload/ });

  const input = document.body.querySelector('input[type="file"]');
  if (!input) throw new Error("file input not found");
  fireEvent.change(input, { target: { files: [] } });

  expect(mocks.generateUploadUrlMock).not.toHaveBeenCalled();
});

test("PhotoUploader shows a generic message for non-Error upload failures", async () => {
  await using mocks = usePhotoUploaderMocks();
  // eslint-disable-next-line no-throw-literal
  mocks.generateUploadUrlMock.mockRejectedValueOnce("boom" as never);

  await using view = renderResource(render(<PhotoUploader babyId={BABY_ID} photoUrl={null} />));
  fireEvent.click(view.getByRole("button", { name: "Add" }));
  await screen.findByRole("button", { name: /Upload/ });

  selectFile(new File(["img"], "baby.png", { type: "image/png" }));

  await vi.waitFor(() => {
    expect(toast.error).toHaveBeenCalledWith("Failed to upload photo");
  });
});

test("PhotoUploader shows generic messages for non-Error failures", async () => {
  await using mocks = usePhotoUploaderMocks();
  // eslint-disable-next-line no-throw-literal
  mocks.updatePhotoMock.mockRejectedValueOnce("boom" as never);

  await using view = renderResource(
    render(<PhotoUploader babyId={BABY_ID} photoUrl="https://example.com/photo.jpg" />),
  );
  fireEvent.click(view.getByRole("button", { name: "Change" }));
  await screen.findByRole("button", { name: /Replace/ });
  clickRemoveButton();

  await vi.waitFor(() => {
    expect(toast.error).toHaveBeenCalledWith("Failed to remove photo");
  });
});

test("PhotoUploader surfaces photo removal failures", async () => {
  await using mocks = usePhotoUploaderMocks();
  mocks.updatePhotoMock.mockRejectedValueOnce(new Error("Remove failed") as never);

  await using view = renderResource(
    render(<PhotoUploader babyId={BABY_ID} photoUrl="https://example.com/photo.jpg" />),
  );

  fireEvent.click(view.getByRole("button", { name: "Change" }));
  await screen.findByRole("button", { name: /Replace/ });
  clickRemoveButton();

  await vi.waitFor(() => {
    expect(toast.error).toHaveBeenCalledWith("Remove failed");
  });
});
