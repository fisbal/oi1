#!/usr/bin/env python3
"""Builds the shield's world list (run every day by .github/workflows/shield-feed.yml).

Downloads public lists of phishing and malware sites, keeps only a 7-byte SHA-256 fingerprint of each site name,
and splits them into 256 small files (h/00.txt .. h/ff.txt) so an app downloads only the file it needs and never
tells anyone which site it checks. Adds the antidotes Martin approved (GitHub issues labelled "antidote" AND
"approved"). Sources and licences:
  Phishing.Database (Mitchell Krog, MIT)       https://github.com/Phishing-Database/Phishing.Database
  URLhaus (abuse.ch, CC0)                       https://urlhaus.abuse.ch
  Block List Project phishing + scam (Unlicense) https://github.com/blocklistproject/Lists
"""
import hashlib, json, os, re, sys, urllib.request, datetime

SOURCES = [
    ('Phishing.Database (MIT)', 'https://raw.githubusercontent.com/Phishing-Database/Phishing.Database/master/phishing-domains-ACTIVE.txt'),
    ('URLhaus (CC0)', 'https://urlhaus.abuse.ch/downloads/text_online/'),
    ('Block List Project phishing (Unlicense)', 'https://raw.githubusercontent.com/blocklistproject/Lists/master/alt-version/phishing-nl.txt'),
    ('Block List Project scam (Unlicense)', 'https://raw.githubusercontent.com/blocklistproject/Lists/master/alt-version/scam-nl.txt'),
]
# Never listed, whatever a feed says (shared hosting where one bad page must not block everyone).
NEVER = {'google.com', 'docs.google.com', 'sites.google.com', 'drive.google.com', 'github.com', 'github.io', 'raw.githubusercontent.com',
         'microsoft.com', 'live.com', 'office.com', 'sharepoint.com', 'onedrive.live.com', '1drv.ms', 'dropbox.com', 'apple.com', 'icloud.com',
         'amazon.com', 'amazonaws.com', 's3.amazonaws.com', 'cloudfront.net', 'facebook.com', 'instagram.com', 'linkedin.com', 'twitter.com', 'x.com',
         'youtube.com', 'wikipedia.org', 'fisbal.github.io', 'canada.ca', 'gouv.fr', 'weebly.com', 'wixsite.com', 'blogspot.com', 'firebaseapp.com',
         'web.app', 'pages.dev', 'workers.dev', 'netlify.app', 'vercel.app', 'herokuapp.com', 'azurewebsites.net', 'windows.net', 'godaddysites.com', 'ipfs.io'}
HOST = re.compile(r'^[a-z0-9.-]+\.[a-z]{2,}$')

def fetch(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'OfficeIn1-shield/1.0 (+https://github.com/fisbal/oi1)'})
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read().decode('utf-8', 'replace')

def hosts_of(text):
    for line in text.splitlines():
        line = line.strip().lower()
        if not line or line.startswith(('#', '!')):
            continue
        if '://' in line:
            line = line.split('://', 1)[1]
        line = line.split('/', 1)[0].split(':', 1)[0].split(' ')[-1]
        if line.startswith('www.'):
            line = line[4:]
        if HOST.match(line) and line not in NEVER and not any(line.endswith('.' + n) and n in ('google.com', 'microsoft.com', 'apple.com', 'github.com') for n in NEVER):
            yield line

def approved_antidotes():
    token, repo = os.environ.get('GITHUB_TOKEN'), os.environ.get('GITHUB_REPOSITORY')
    if not token or not repo:
        return [], []
    req = urllib.request.Request(f'https://api.github.com/repos/{repo}/issues?labels=antidote,approved&state=all&per_page=100',
                                 headers={'Authorization': f'Bearer {token}', 'Accept': 'application/vnd.github+json'})
    try:
        issues = json.loads(urllib.request.urlopen(req, timeout=60).read())
    except Exception as e:  # the list still updates without them
        print('antidotes skipped:', e, file=sys.stderr)
        return [], []
    files, hosts = [], []
    for i in issues:
        body = i.get('body') or ''
        kind = re.search(r'^kind:\s*(file|host)\s*$', body, re.M)
        key = re.search(r'^key:\s*(\S+)\s*$', body, re.M)
        if not kind or not key:
            continue
        k = key.group(1).lower()
        if kind.group(1) == 'file' and re.fullmatch(r'[0-9a-f]{64}', k):
            files.append(k)
        elif kind.group(1) == 'host' and HOST.match(k) and k not in NEVER:
            hosts.append(k)
    return sorted(set(files)), sorted(set(hosts))

def main(out):
    all_hosts, used = set(), []
    for name, url in SOURCES:
        try:
            got = set(hosts_of(fetch(url)))
            print(f'{name}: {len(got)}')
            if got:
                all_hosts |= got
                used.append(name)
        except Exception as e:
            print(f'{name} failed: {e}', file=sys.stderr)
    files, hosts = approved_antidotes()
    all_hosts |= set(hosts)
    if len(all_hosts) < 1000:
        sys.exit('too few sites: keeping yesterday\'s list')
    shards = {f'{i:02x}': [] for i in range(256)}
    for h in all_hosts:
        d = hashlib.sha256(h.encode()).hexdigest()
        shards[d[:2]].append(d[2:16])
    os.makedirs(os.path.join(out, 'h'), exist_ok=True)
    for p, items in shards.items():
        with open(os.path.join(out, 'h', f'{p}.txt'), 'w') as f:
            f.write('\n'.join(sorted(set(items))) + '\n')
    meta = {'updated': datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds'), 'count': len(all_hosts),
            'sources': used, 'antidotes': {'files': files, 'hosts': hosts}, 'format': 'sha256(host)[2:16] in h/<sha256[:2]>.txt'}
    with open(os.path.join(out, 'meta.json'), 'w') as f:
        json.dump(meta, f, indent=1)
    print(json.dumps({k: meta[k] for k in ('updated', 'count', 'sources')}))

if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'shield-data')
