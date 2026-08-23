# Scope Delta Analysis — Solstice Check-in Kiosk Pivot

## Original Spec

The original check-in workflow was synchronous:

`scan badge -> call printer API directly -> wait for response -> show Checked In`

The attendee was only marked as checked in after the print operation succeeded during the same request-response cycle.

## New Spec (Post-Pivot)

The new workflow is asynchronous:

`scan badge -> enqueue print job -> respond immediately with pending -> worker processes job -> printer completion webhook arrives -> update attendee to checked_in`

The system now accepts the work separately from confirming its completion.

## Dropped

* Direct synchronous calls to the printer API as part of the check-in request.
* Waiting for the printer operation to finish before responding to the kiosk.
* Immediate final `Checked In` confirmation in the same request-response cycle.
* The assumption that check-in is a single uninterrupted operation.

## Modified

* **Architecture:** The workflow changed from synchronous request-response processing to asynchronous, event-driven processing.
* **Attendee status model:** The model changed from two states, `not_checked_in` and `checked_in`, to three states: `not_checked_in`, `pending`, and `checked_in`.
* **Duplicate-scan protection:** The system must now reject duplicate scans for attendees who are either `pending` or `checked_in`. A second scan during the in-flight period is a new failure case created by the asynchronous design.
* **Response semantics:** A final successful response became a provisional `202 Accepted` response with a `pending` status.
* **Completion mechanism:** The final state is no longer determined by the original scan request. It is determined later when the completion webhook is received.
* **Ordering assumptions:** The system can no longer assume that confirmations will arrive in the same order as jobs were submitted.

## Added

* An in-memory message queue to hold print jobs between the initial scan and completion.
* A worker process to consume and process queued jobs.
* A `pending` attendee state representing work that has been accepted but not yet confirmed as complete.
* A completion webhook endpoint, `/webhooks/print-complete`.
* A status-check endpoint, `/attendees/:id`, to observe whether an attendee is still pending or has reached the final `checked_in` state.
* Logic to correctly handle out-of-order completion events.
* Additional duplicate protection for the period between job submission and final completion.

## Regression Check

* [x] Duplicate-scan protection re-verified under the new asynchronous model.
* [x] A repeat scan while an attendee was `pending` was rejected with `409`.
* [x] A repeat scan after an attendee was `checked_in` was rejected with `409`.
* [x] The original three-attendee requirement remained functional.
* [x] Attendees `A-001`, `A-002`, and `A-003` were tested successfully.
* [x] The new asynchronous requirement was verified.
* [x] Out-of-order confirmations were tested successfully.
* [x] The completion order `A-002`, `A-001`, and `A-003` differed from the original queue order, while all attendees still reached the correct final state.

## Reprioritized Backlog

### 1. Persistent Queue and Attendee State

The highest priority is replacing the in-memory queue and state with persistent storage. The current design is suitable for demonstrating the asynchronous workflow, but an application restart can cause queued jobs and current attendee state to be lost. This is the largest reliability gap in the current implementation.

### 2. Retry Logic and Reliable Webhook Handling

The next priority is handling temporary failures during asynchronous processing. A production version should retry failed operations where appropriate and safely handle repeated webhook deliveries. Webhook processing should be designed to avoid incorrect state changes if the same completion event is delivered more than once.

### 3. Replace the In-Memory Queue with a Production Message Broker

After persistence and failure handling are addressed, the in-memory queue should be replaced with a real message queue or broker. This would improve reliability, support multiple workers, and make the architecture more appropriate for larger events and higher check-in volumes.

## Cost of the Pivot

The pivot required substantial changes to the core workflow rather than minor changes to the existing implementation. The project could not simply add a queue around the original synchronous code because the meaning of completion changed.

Some of the existing concepts survived, including attendee identification, basic status tracking, routing, and duplicate-scan protection. However, the central check-in flow had to be redesigned around asynchronous processing.

The most significant conceptual cost was adding and correctly managing the `pending` state. This state created new cases that the original synchronous design did not have, especially duplicate scans while work was still in flight.

The most technically important change was separating the initial scan from the final confirmation. The request that starts the work is no longer the same operation that confirms completion. This required the system to use a queue and worker for processing and a separate webhook route for final state updates.

The pivot also required testing timing-related behavior that did not exist before. In particular, out-of-order completion events had to be considered and verified. The final implementation successfully handled confirmations arriving in a different order from the original job order.

Overall, the pivot changed the architecture more than the visible purpose of the application. The system still performs event check-in, but it now does so through an asynchronous workflow that is more flexible and realistic while also introducing additional reliability and state-management responsibilities.
