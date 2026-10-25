import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import { bookAppointment, lookupAppointments } from './api.js';

const originalFetch = globalThis.fetch;
const originalLocalStorage = globalThis.localStorage;

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalLocalStorage === undefined) {
    delete globalThis.localStorage;
  } else {
    globalThis.localStorage = originalLocalStorage;
  }
});

test('booking reports a slot conflict with the backend status and message', async () => {
  globalThis.localStorage = { getItem: () => null };
  globalThis.fetch = async () => new Response(JSON.stringify({
    error: 'This appointment slot has already been booked.',
    code: 'SLOT_CONFLICT'
  }), {
    status: 409,
    headers: { 'content-type': 'application/json' }
  });

  await assert.rejects(
    bookAppointment({ doctor_id: 1 }),
    (error) => error.status === 409
      && error.message === 'This appointment slot has already been booked.'
  );
});

test('appointment lookup sends the access code in a header, not the URL', async () => {
  globalThis.localStorage = { getItem: () => null };
  let requestUrl;
  let requestOptions;
  globalThis.fetch = async (url, options) => {
    requestUrl = url;
    requestOptions = options;
    return new Response('[]', {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  };

  const appointments = await lookupAppointments('patient@example.com', 'private-code');

  assert.deepEqual(appointments, []);
  assert.match(requestUrl, /patient%40example\.com/);
  assert.doesNotMatch(requestUrl, /private-code/);
  assert.equal(requestOptions.headers['X-Appointment-Access-Token'], 'private-code');
});
