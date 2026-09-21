# 炭酸シェイク！ tuning and deployment

The browser constants in [`constants.ts`](./constants.ts) and the immutable
`private.carbonated_shake_tuning()` function in
[`20260921000000_add_carbonated_shake.sql`](../../../supabase/migrations/20260921000000_add_carbonated_shake.sql)
are deliberately kept as a checked-in pair. If a score level, amount cap, carbonation rate,
limit range, danger threshold, noise bucket, or hint timing changes, update
both representations and run the TypeScript and database tests together. The
hidden burst capacity is sampled from 110–130 carbonation units per player, so
the initialized roster size scales the private limit linearly.
The SQL helper `carbonated_shake_max_amount()` derives the accepted amount cap
from the configured level that reaches `maxTurnScore`, so the server stops at
the same level as the client score curve.

Applied Supabase migrations are immutable. Deploy
`20260921000000_add_carbonated_shake.sql` followed by
`20260921010000_protect_carbonated_shake_room.sql`; future tuning changes must
be shipped in a new timestamped migration that replaces
`carbonated_shake_tuning()` and its dependent helper functions. Do not edit an
already applied migration in place. The room trigger migration also protects
the public projection from direct client replacement while allowing the
existing authorized host lobby reset.

After a safe turn, the private hint remains available to its owner for about
four seconds. The server keeps the display gate open for the full four seconds
and permits recovery after the six-second pending/recovery deadline when a
client disconnects or loses the response.

Shake progress is shown optimistically for responsiveness, then sent to the
server as a cumulative amount about every 120 ms. The server response remains
authoritative for the burst and score, so a slow network can make the burst
animation arrive after the local gauge reaches its apparent limit. There is no
time limit on a turn.

DeviceMotion requires a secure context and a direct user gesture on browsers
that expose a permission prompt. If a device has no usable motion events, the
game offers an explicit pointer fallback; its progress is only counted while
the HOLD control is held. Browser and OS sensor scaling varies, so the fallback
and motion normalization are practical playability aids rather than a
cross-device physical measurement.
