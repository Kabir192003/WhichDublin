"""Split the per-departure trip ids (data/build/<daytype>/stop-trips.json) into small files so the Commute page
only downloads the few kilobytes for the stop being looked at.

  public/data/trips/<daytype>/<shard>.json   { "stopId:routeId:directionId": [[minutesAfterMidnight, tripId], ...] }

The shard of a stop is a hash of its id (see shard() below).
Run after build-stops.py has been run for each day type (wk, sat, sun)."""
import json, os, sys

SHARDS = 256
def shard(stop_id):   # FNV-1a, 32 bit: spreads the near-identical stop ids evenly. src/components/Stop.jsx uses the same rule.
    h = 0x811c9dc5
    for c in stop_id: h = ((h ^ ord(c)) * 0x01000193) & 0xFFFFFFFF
    return h % SHARDS

for dt in ('wk', 'sat', 'sun'):
    src = f'data/build/{dt}/stop-trips.json'
    if not os.path.exists(src):
        print('missing', src); continue
    trips = json.load(open(src))
    out = {}
    for key, entries in trips.items():
        out.setdefault(shard(key.split(':')[0]), {})[key] = entries
    d = f'public/data/trips/{dt}'
    os.makedirs(d, exist_ok=True)
    for n in range(SHARDS):
        json.dump(out.get(n, {}), open(f'{d}/{n}.json', 'w'), separators=(',', ':'))
    print(dt, 'keys', len(trips), 'largest shard', max(len(json.dumps(v)) for v in out.values()))
