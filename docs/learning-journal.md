# Learning Journal — Solstice Check-in Kiosk Pivot

## Overview

This project required rebuilding a synchronous event check-in workflow into an asynchronous one. The original model was straightforward: a badge was scanned, the application called the printer service directly, waited for the result, and only confirmed the attendee as checked in after printing succeeded.

The pivot changed that architecture significantly. Instead of waiting for the printer process to complete, the kiosk now creates a print job, places it on an in-memory queue, and immediately returns a `pending` response. A worker processes the queued job, and the final confirmation arrives through a webhook. The attendee is only moved to `checked_in` when that completion webhook is received.

The main lesson from this pivot was that asynchronous systems do not simply make a synchronous process faster. They introduce new states, new failure modes, and a need to think about timing and ordering.

## What I Built

I created a new project for the Solstice Events kiosk rather than adding the pivot into the previous Northstar inventory project. I used Express for the HTTP routing and an in-memory queue so that the main learning focus could remain on asynchronous processing, workers, and webhooks without introducing the additional setup of an external message broker.

The final flow was:

`scan attendee -> validate status -> enqueue print job -> return pending -> worker processes job -> completion webhook arrives -> attendee becomes checked_in`

I also added a status-check endpoint so that the current attendee state could be observed while a print job was still pending.

The project was committed progressively rather than as one final upload. The repository history includes separate commits for the initial setup, data and queue logic, routes, and the learning journal.

## What Changed in My Understanding

Before the pivot, I mostly thought of a successful API request as meaning that the underlying task had completed. This project made the difference between **accepted** and **completed** much clearer.

In the new model, returning `202 Accepted` means the system has accepted responsibility for the work, not that the work is finished. The attendee can therefore be in a `pending` state for a period of time before the final confirmation arrives.

That distinction also changed how I understood duplicate requests. In the original synchronous model, the main duplicate case was scanning someone who had already been checked in. In the asynchronous model, a second scan can happen while the first job is still in flight. Therefore, `pending` also has to be treated as a protected state. Otherwise, repeated scans could create multiple print jobs for the same attendee.

## Challenges and Problems Encountered

The most challenging part was adjusting the logic from a simple two-state model to a workflow where completion happens later.

The attendee state changed from:

`not_checked_in -> checked_in`

to:

`not_checked_in -> pending -> checked_in`

This introduced timing as part of the system's behavior. The application could no longer assume that operations would finish in the same order in which requests were received.

I also had to think about what would happen when confirmations arrived out of order. The queue and worker model could begin processing jobs in one order, but webhook confirmations could arrive in another order. I tested this by completing attendees in the order `A-002`, `A-001`, and `A-003`. Even though that order differed from the queue order, each attendee still reached the correct final state.

A practical limitation I also encountered was that the queue and application state were stored in memory. This makes the project simple to demonstrate, but it means a restart would lose queued jobs and current state. That failure mode made the difference between a learning prototype and a production-ready asynchronous system much more obvious.

## What I Tested

I verified the following behaviors:

* The original three attendees, `A-001`, `A-002`, and `A-003`, could still be processed.
* A valid scan changed the attendee to `pending` and returned a `202` response rather than waiting for final completion.
* A duplicate scan while an attendee was `pending` was rejected with `409`.
* A duplicate scan after the attendee reached `checked_in` was also rejected with `409`.
* The webhook updated the correct attendee to `checked_in`.
* Out-of-order webhook confirmations did not cause the wrong attendee to be updated.
* The final state of all three attendees was correct despite the completion order differing from the original processing order.

## Most Important Learning

The most important lesson from this pivot was that asynchronous architecture changes the meaning of success and requires explicit handling of intermediate states.

The queue itself was relatively simple to implement. The harder part was making the rest of the system behave correctly around the queue. Duplicate protection had to understand `pending` status, API responses had to distinguish between accepted and completed work, and the webhook had to update attendees independently of the order in which jobs were originally submitted.

I also learned that asynchronous systems require thinking about events as separate from requests. A request may start work, while another event later confirms that the work actually finished.

## What I Would Improve Next

My first improvement would be persistence. An in-memory queue is useful for demonstrating the architecture, but it is not resilient to application restarts. A production system should persist jobs and attendee state so work is not silently lost.

Second, I would add retry logic and stronger failure handling around webhook delivery. The current demonstration proves the successful path, but a production system also needs to handle temporary failures and repeated deliveries safely.

Third, I would replace the in-memory queue with a real message broker. This would provide better reliability and make the system more suitable for multiple workers and higher volumes of check-ins.

## Conclusion

This pivot forced me to move away from a simple request-response mindset. The original implementation could treat a request as a complete transaction. The new architecture had to separate accepting work from completing work.

The project demonstrated that the system could protect against duplicate scans, maintain correct attendee state, and handle out-of-order webhook confirmations. More importantly, it showed me that moving to asynchronous processing creates architectural responsibilities beyond simply adding a queue.
