// server.js

const express = require("express");
const attendees = require("./data/attendees");
const { enqueue, onJobComplete } = require("./queue");

const app = express();
app.use(express.json());

// ---- Check-in route ----
// Staff scan a badge -> this endpoint fires.
app.post("/checkin/:attendeeId", (req, res) => {
  const { attendeeId } = req.params;
  const attendee = attendees[attendeeId];

  if (!attendee) {
    return res.status(404).json({ error: "Attendee not found" });
  }

  // Duplicate-scan protection: reject if already checked in OR already
  // pending — a second scan while a print job is still in flight must
  // not queue a second print job.
  if (attendee.status === "checked_in") {
    return res.status(409).json({
      error: "Already checked in",
      attendee_id: attendeeId,
      status: attendee.status,
    });
  }

  if (attendee.status === "pending") {
    return res.status(409).json({
      error: "Check-in already in progress",
      attendee_id: attendeeId,
      status: attendee.status,
    });
  }

  // Not checked in yet -> mark pending and enqueue the print job.
  // Note: we respond BEFORE the print job finishes. That's the whole
  // point of the pivot — no more waiting for the printer's answer.
  attendee.status = "pending";
  enqueue({ attendee_id: attendeeId });

  res.status(202).json({
    attendee_id: attendeeId,
    status: attendee.status,
    message: "Check-in accepted, print job queued",
  });
});

// ---- Webhook route ----
// The printer vendor (simulated by our queue) calls THIS when a print
// job finishes. We didn't call this — it called us.
app.post("/webhooks/print-complete", (req, res) => {
  const { attendee_id } = req.body;
  const attendee = attendees[attendee_id];

  if (!attendee) {
    return res.status(404).json({ error: "Unknown attendee in webhook payload" });
  }

  attendee.status = "checked_in";
  console.log(`[webhook] ${attendee_id} confirmed checked_in`);

  res.status(200).json({ received: true });
});

// Wire the queue's completion event to actually CALL our own webhook,
// simulating the vendor reaching back out to us over HTTP.
onJobComplete((job) => {
  fetch(`http://localhost:${PORT}/webhooks/print-complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ attendee_id: job.attendee_id }),
  }).catch((err) => console.error("[webhook call failed]", err));
});

// ---- Status check route (handy for testing) ----
app.get("/attendees/:attendeeId", (req, res) => {
  const attendee = attendees[req.params.attendeeId];
  if (!attendee) {
    return res.status(404).json({ error: "Attendee not found" });
  }
  res.status(200).json(attendee);
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Solstice check-in kiosk running on http://localhost:${PORT}`);
});