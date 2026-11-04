"""Short neighbourhood descriptions from Wikipedia (CC BY-SA 4.0), with the page URL for attribution.
For each rent area, search '<name> Dublin', take the top hit, and keep it only if the extract mentions Dublin.
Output: data/raw/descriptions.json   (build step trims to the first 2 sentences)"""
import json, time, urllib.request, urllib.parse, urllib.error, re

UA = 'WhichDublin/0.1 (student research prototype; github.com/Kabir192003/whichdublin)'
def get(url, tries=6):
    for i in range(tries):
        try:
            return json.load(urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=30))
        except urllib.error.HTTPError as e:
            if e.code == 429 and i < tries - 1: time.sleep(4 * (i + 1)); continue
            raise

areas = json.load(open('data/build/rent.json'))['areas']
out = {}
for a in areas:
    name = a['name']
    q = f"{name} Dublin" + (f" {a['district'].replace('D', 'D')}" if False else '')
    try:
        s = get('https://en.wikipedia.org/w/api.php?' + urllib.parse.urlencode({'action': 'query', 'list': 'search', 'srsearch': q, 'srlimit': 3, 'format': 'json'}))
        hits = s['query']['search']
        got = None
        for h in hits:
            summ = get('https://en.wikipedia.org/api/rest_v1/page/summary/' + urllib.parse.quote(h['title'].replace(' ', '_'), safe=''))
            ext = summ.get('extract', '')
            title_ok = name.lower().split(' ')[0] in summ.get('title', '').lower() or name.lower().split(' ')[0] in ext.lower()[:200]
            if 'Dublin' in ext and title_ok and summ.get('type') == 'standard':
                got = {'title': summ['title'], 'extract': ext, 'url': summ['content_urls']['desktop']['page']}; break
        out[a['id']] = got
        print(('ok  ' if got else 'none'), name, '->', got['title'] if got else '')
    except Exception as ex:
        out[a['id']] = None; print('ERR ', name, ex)
    time.sleep(1.0)
json.dump({'source': 'Wikipedia, CC BY-SA 4.0', 'fetched': time.strftime('%Y-%m-%d'), 'items': out}, open('data/raw/descriptions.json', 'w'), indent=1, ensure_ascii=False)
print('described', sum(1 for v in out.values() if v), 'of', len(out))
