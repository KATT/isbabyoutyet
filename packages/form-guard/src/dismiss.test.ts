import { expect, test } from "vitest";
import { isNativeDatePickerDismiss, shouldBlockOverlayDismiss } from "./dismiss.js";

test("shouldBlockOverlayDismiss locks user dismissals but allows imperative closes", () => {
  expect(
    shouldBlockOverlayDismiss({
      isLocked: true,
      open: false,
      reason: "escape-key",
    }),
  ).toBe(true);
  expect(
    shouldBlockOverlayDismiss({
      isLocked: true,
      open: false,
      reason: "outside-press",
    }),
  ).toBe(true);
  expect(
    shouldBlockOverlayDismiss({
      isLocked: true,
      open: false,
      reason: "close-press",
    }),
  ).toBe(true);
  expect(
    shouldBlockOverlayDismiss({
      isLocked: true,
      open: false,
      reason: "imperative-action",
    }),
  ).toBe(false);
  expect(
    shouldBlockOverlayDismiss({
      isLocked: false,
      open: false,
      reason: "escape-key",
    }),
  ).toBe(false);
  expect(
    shouldBlockOverlayDismiss({
      isLocked: true,
      open: true,
      reason: "trigger-press",
    }),
  ).toBe(false);
});

test("native date picker focus turns outside-press into a picker dismiss", () => {
  const dateInput = document.createElement("input");
  dateInput.type = "date";
  document.body.append(dateInput);
  dateInput.focus();

  expect(isNativeDatePickerDismiss("outside-press")).toBe(true);
  expect(isNativeDatePickerDismiss("focus-out")).toBe(true);
  expect(isNativeDatePickerDismiss("escape-key")).toBe(false);

  dateInput.remove();

  const textInput = document.createElement("input");
  textInput.type = "text";
  document.body.append(textInput);
  textInput.focus();
  expect(isNativeDatePickerDismiss("outside-press")).toBe(false);
  textInput.remove();
});
