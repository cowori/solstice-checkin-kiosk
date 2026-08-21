// queue.js
//
// A minimal in-memory queue. Real message queues (RabbitMQ, SQS) do
// this same job — hold messages until something is ready to process
// them — but persist them outside your app's memory and survive a
// crash. This version doesn't survive a restart, which is a real
// limitation worth noting in your journal later.

const jobs = [];
const listeners = [];

function enqueue(job) {
  jobs.push(job);
  console.log(`[queue] job added:`, job);
  processNext();
}

function onJobComplete(callback) {
  listeners.push(callback);
}

function processNext() {
  if (jobs.length === 0) return;
  const job = jobs.shift();

  // Simulate the printer vendor taking real time to process the job,
  // instead of resolving instantly — this is what makes "pending" a
  // real, observable state instead of a flash you can't even see.
  const delayMs = 3000 + Math.random() * 2000; // 3-5 seconds
  console.log(`[queue] processing job for ${job.attendee_id}, will complete in ~${Math.round(delayMs / 1000)}s`);

  setTimeout(() => {
    console.log(`[queue] job complete for ${job.attendee_id}`);
    listeners.forEach((cb) => cb(job));
  }, delayMs);
}

module.exports = { enqueue, onJobComplete };