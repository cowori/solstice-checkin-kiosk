// data/attendees.js
//
// A simple in-memory store of attendees and their check-in status.
// Three possible statuses:
//   "not_checked_in" — hasn't been scanned yet
//   "pending"         — scanned, print job queued, waiting on webhook confirmation
//   "checked_in"      — webhook confirmed the badge printed successfully

const attendees = {
  "A-001": { attendee_id: "A-001", name: "Jordan Lee", status: "not_checked_in" },
  "A-002": { attendee_id: "A-002", name: "Priya Shah", status: "not_checked_in" },
  "A-003": { attendee_id: "A-003", name: "Sam Okafor", status: "not_checked_in" },
};

module.exports = attendees;