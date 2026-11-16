import assert from "node:assert/strict"
import test from "node:test"
import { buildSlots } from "./slots"

test("reserva a duração e esconde horário ocupado", () => {
  const slots = buildSlots({
    day: "2026-11-16",
    open: "09:00",
    close: "12:00",
    durationMin: 60,
    stepMin: 60,
    now: new Date("2026-11-16T08:00:00-03:00").getTime(),
    busy: [
      {
        startsAt: new Date("2026-11-16T10:00:00-03:00").toISOString(),
        endsAt: new Date("2026-11-16T11:00:00-03:00").toISOString(),
      },
    ],
  })

  assert.deepEqual(
    slots.map((slot) => new Date(slot).toISOString()),
    [
      new Date("2026-11-16T09:00:00-03:00").toISOString(),
      new Date("2026-11-16T11:00:00-03:00").toISOString(),
    ],
  )
})

test("não oferece horário que já passou", () => {
  const slots = buildSlots({
    day: "2026-11-16",
    open: "09:00",
    close: "11:00",
    durationMin: 30,
    stepMin: 30,
    now: new Date("2026-11-16T09:40:00-03:00").getTime(),
    busy: [],
  })
  assert.deepEqual(slots, [new Date("2026-11-16T10:00:00-03:00").toISOString(), new Date("2026-11-16T10:30:00-03:00").toISOString()])
})
