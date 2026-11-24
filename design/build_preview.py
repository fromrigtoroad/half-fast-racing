import json,html,os,collections,datetime,re,sys
e=html.escape
hits=json.load(open('hfr_hits.json'))
if os.path.exists('hfr_hits_old.json'): hits+=json.load(open('hfr_hits_old.json'))
hits=[x for x in hits if x['date']>='2018-06-01']  # 2012-2016 'Half Fast Racing' (NJ, cars 92-96) unconfirmed as the same team
evs={}
for x in hits:
    k=(x['date'],re.sub(r'\W','',(x['session'] or '').lower())); r=x['row']
    ev=evs.setdefault(k,{'date':x['date'],'race':re.sub(r'\s*20\d\d$','',x['session'] or ''),'track':x['event'].replace('24 Hours of Lemons-','').replace('24 Hours of LeMons-','').replace(' 2026',''),'of':0,'cars':{}})
    n=r.get('startNumber') or '?'; c=ev['cars']
    if n not in c or (r.get('numberOfLaps') or 0)>c[n]['laps']:
        c[n]={'pos':r.get('position') or 999,'cls':r.get('resultClass') or '','pic':r.get('positionInClass'),'laps':r.get('numberOfLaps') or 0,'best':(r.get('bestTime') or '').lstrip('0')}
        ev['of']=max(ev['of'],x['of'])
years=collections.OrderedDict()
for k in sorted(evs,reverse=True): years.setdefault(k[0][:4],[]).append(evs[k])
YL=list(years); CUR=YL[0]
def day(d):
    t=datetime.date.fromisoformat(d)+datetime.timedelta(days=1); return t.strftime('%b %-d')
def lead(ev): return sorted(ev['cars'].items(),key=lambda kv:kv[1]['pos'])
def agg(evl):
    cars=[c for ev in evl for c in ev['cars'].values()]; best=[lead(ev)[0][1] for ev in evl]
    return {'races':len(evl),'laps':sum(c['laps'] for c in cars),'best':min(c['pos'] for c in cars),'top5':sum(1 for b in best if b['pos']<=5),'top10':sum(1 for b in best if b['pos']<=10),'clspod':sum(1 for c in cars if c['pic'] and c['pic']<=3),'starts':len(cars)}
ALL=agg([ev for y in years.values() for ev in y]); A26=agg(years[CUR])

MULTI=False
def L(p): 
    if MULTI: return ('index' if p=='home' else p)+'.html'
    return '#'+p if p!='home' else '#home'
def stat(n,l,hl=False): return f"<div class='st{' hl' if hl else ''}'><b>{n}</b><span>{l}</span></div>"
def table(evl,limit=None):
    rows=""
    for ev in evl[:limit]:
        cars=lead(ev); n,c=cars[0]
        oth="".join(f"<span class='chip'>#{e(m)} <i>P{x['pos']}</i></span>" for m,x in cars[1:])
        cl=f"{e(c['cls'])} · P{c['pic']}" if c['pic'] else e(c['cls'])
        rows+=f"<tr><td class='d'>{day(ev['date'])}</td><td><strong>{e(ev['race'])}</strong><small>{e(ev['track'])}</small></td><td class='m'>#{e(n)}</td><td class='pc'><span class='pos{' top' if c['pos']<=5 else ''}'>P{c['pos']}</span><span class='of'>/ {ev['of']}</span></td><td class='m nw'>{cl}</td><td class='m r'>{c['laps']}</td><td class='m r'>{e(c['best'])}</td><td class='oth'>{oth}</td></tr>"
    return f"<div class='tbl'><table><thead><tr><th>Date</th><th>Race</th><th>Car</th><th>Overall</th><th>Class</th><th class='r'>Laps</th><th class='r'>Best lap</th><th>Other team cars</th></tr></thead><tbody>{rows}</tbody></table></div>"
def tabs(active):
    t=f"<a class='{'on' if active=='all' else ''}' href='{L('results')}'>{CUR}</a>"
    for y in YL[1:]: t+=f"<a class='{'on' if active==y else ''}' href='{L('results-'+y)}'>{y}</a>"
    return f"<nav class='tabs' aria-label='Seasons'>{t}</nav>"
def fleet(evl):
    f={}
    for ev in evl:
        for n,c in ev['cars'].items():
            x=f.setdefault(n,{'starts':0,'best':999,'laps':0,'cls':c['cls'],'res':[]}); x['starts']+=1; x['best']=min(x['best'],c['pos']); x['laps']+=c['laps']; x['res'].append((ev,c))
    return sorted(f.items(),key=lambda kv:(-kv[1]['starts'],kv[1]['best']))
FL=fleet(years[CUR])
def carcard(n,f,full=False):
    res=""
    if full: res="<ul class='cres'>"+"".join(f"<li><span>{day(ev['date'])} · {e(ev['track'])}</span><b>P{c['pos']}</b></li>" for ev,c in f['res'][:4])+"</ul>"
    return f"<article class='car'><div class='carhead'><div class='num'>{e(n)}</div><span class='cls'>Class {e(f['cls'] or '?')}</span></div><div class='slot'>Photo: from the crew</div><dl><div><dt>Starts {CUR}</dt><dd>{f['starts']}</dd></div><div><dt>Best</dt><dd>P{f['best']}</dd></div><div><dt>Laps</dt><dd>{f['laps']:,}</dd></div></dl>{res}<p class='tbd'>Make, model and how it got here: coming from the crew.</p></article>"

last=years[CUR][0]; ln,lc=lead(last)[0]
others=lead(last)[1:]
oth_txt=(" "+" and ".join(f"car #{m} finished P{x['pos']}" for m,x in others)+".").replace(" car"," Car",1) if others else ""
tower="""<aside class="tower" aria-label="National team points">
<div class="th"><span>National points · Teams</span><span>2026</span></div>
<div class="trow"><b>1</b><span>Mo Minis Mo Problems</span><i>163</i></div>
<div class="trow us"><b>2</b><span>Half-Fast Racing</span><i>158</i></div>
<div class="trow"><b>3</b><span>Battle Scarred Motorsports</span><i>85</i></div>
<div class="trow"><b>4</b><span>TATAS</span><i>48</i></div>
<div class="trow"><b>5</b><span>BostonWeiners</span><i>47</i></div>
<div class="conf"><div><b>P1</b><span>South · 71 pts</span></div><div><b>P2</b><span>Midwest · 30 pts</span></div><div><b>P3</b><span>Gulf · 50 pts</span></div></div>
<div class="tf">Official standings, 24hoursoflemons.com. Checked Nov 23, 2026.</div></aside>"""
P={}
P['home']=f"""
<section class="hero"><div class="wrap">
 <div class="ghost" aria-hidden="true">{e(ln)}</div>
 <div class="herogrid"><div>
  <p class="kicker">24 Hours of Lemons · Endurance racing on $500 cars</p>
  <h1>Half fast.<br>Fully <span>committed.</span></h1>
  <p class="lede">Ten-plus years of racing cars that cost less than a set of tires. Second in the national points right now, five off the lead.</p>
  <div class="btns"><a class="btn" href="{L('results')}">See the results <span>→</span></a><a class="btn alt" href="{L('cars')}">Meet the cars</a></div>
 </div><img class="sticker" src="logo.webp" width="640" height="409" alt="Half Fast Racing team logo"></div>
</div>
<div class="wrap"><div class="statbar">{stat('P2','National points',True)}{stat('158','Points')}{stat(A26['races'],f'Race weekends {CUR}')}{stat('P'+str(A26['best']),'Best finish')}{stat(f"{A26['laps']:,}",'Laps completed')}</div></div>
</section>
<section class="wrap"><div class="nextrace"><div><p class="kicker">Next green flag</p><h2>The Kim Harmon Scrotium 500</h2><p class="where">Road Atlanta · Braselton, GA · Dec 12–13, 2026</p></div>
 <div class="clock" data-t="2026-12-12T09:00:00-05:00"><div><b>--</b><span>Days</span></div><div><b>--</b><span>Hrs</span></div><div><b>--</b><span>Min</span></div></div></div></section>
<section class="wrap two"><div>
 <p class="kicker">Latest result</p>
 <article class="latest"><div class="bigp">P{lc['pos']}<small>of {last['of']}</small></div><div>
  <h3>{e(last['race'])}</h3><p class="where">{e(last['track'])} · {day(last['date'])}, {last['date'][:4]} · Car #{e(ln)}</p>
  <dl class="mini"><div><dt>Class {e(lc['cls'])}</dt><dd>P{lc['pic']}</dd></div><div><dt>Laps</dt><dd>{lc['laps']}</dd></div><div><dt>Best lap</dt><dd>{e(lc['best'])}</dd></div></dl>
  <p class="note">Third overall and second in class, three laps behind the winner after two days of racing.{e(oth_txt)}</p></div></article>
</div><div><p class="kicker">Championship</p>{tower}</div></section>
<section class="wrap"><div class="sechead"><div><p class="kicker">Season {CUR}</p><h2>Recent races</h2></div><a class="more" href="{L('results')}">All results →</a></div>{table(years[CUR],5)}</section>
<section class="wrap"><div class="sechead"><div><p class="kicker">The fleet</p><h2>Cheap cars, raced hard</h2></div><a class="more" href="{L('cars')}">All cars →</a></div><div class="fleet">{''.join(carcard(n,f) for n,f in FL[:4])}</div></section>
<section class="paper"><div class="wrap papergrid"><div><p class="kicker dark">How Lemons works</p><h2>The car can't cost more than $500</h2><p>That's the rule. Safety gear doesn't count, and the judges decide if you're telling the truth. Every car on this team has a receipt, and we'll publish each one.</p></div>
 <div class="receipt" aria-label="Sample budget receipt"><div class="rh">HALF FAST RACING<br>CAR #{e(ln)} · BUDGET</div><div><span>1 × race car, pre-loved</span><span>$???</span></div><div><span>Junkyard parts</span><span>$???</span></div><div><span>Zip ties (qty: yes)</span><span>$???</span></div><div><span>Sold: original seats</span><span>−$??</span></div><div class="tot"><span>LEMONS LIMIT</span><span>$500.00</span></div><div class="rf">*** THANK YOU, COME AGAIN ***</div></div></div></section>
"""
def results_page(y):
    cur=(y==CUR); a=agg(years[y]); evl=years[y]
    head=f"""<section class="pagehead"><div class="wrap"><p class="kicker">Results</p><h1>{'Every lap counted' if cur else y+' season'}</h1>"""
    if cur:
        since=YL[-1]
        head+=f"""<p class="lede">All-time numbers since {since}, straight from official Lemons timing.</p></div>
<div class="wrap"><div class="statbar six">{stat(ALL['races'],'Race weekends')}{stat('P'+str(ALL['best']),'Best finish',True)}{stat(ALL['top5'],'Top-five finishes')}{stat(ALL['top10'],'Top-ten finishes')}{stat(ALL['clspod'],'Class podiums')}{stat(f"{ALL['laps']:,}",'Laps completed')}</div></div>"""
    else: head+="</div>"
    head+="</section>"
    return head+f"""<section class="wrap">{tabs('all' if cur else y)}
<div class="yearsum"><h2>{y}</h2><div class="ys">{stat(a['races'],'Races')}{stat('P'+str(a['best']),'Best')}{stat(a['top5'],'Top fives')}{stat(f"{a['laps']:,}",'Laps')}</div></div>
{table(evl)}<p class="src">Official timing from MyLaps Speedhive. A top-five overall finish is marked in yellow. This page updates itself after every race weekend.</p></section>"""
P['results']=results_page(CUR)
for y in YL[1:]: P['results-'+y]=results_page(y)
P['cars']=f"""<section class="pagehead"><div class="wrap"><p class="kicker">The fleet</p><h1>Cheap cars, raced hard</h1><p class="lede">{len(FL)} cars have run under the Half Fast banner in {CUR}. Numbers below are from official timing; the stories come from the people who built them.</p></div></section>
<section class="wrap"><div class="fleet big">{''.join(carcard(n,f,True) for n,f in FL)}</div></section>"""
own=[('Team owner','Runs the team and the entry list','Owner')]+[(f'Car #{n}',f"Owns and looks after the #{n}",'Car owner') for n,f in FL[:4]]
P['about']=f"""<section class="pagehead"><div class="wrap"><p class="kicker">About the team</p><h1>Not real fast.<br>Still here.</h1><p class="lede">Half Fast Racing is a 24 Hours of Lemons endurance team. We race cars that cost $500 or less, for a whole weekend at a time, against a hundred others.</p></div></section>
<section class="wrap story"><div><h2>The short version</h2>
<p>Lemons is endurance racing for cars nobody else wanted. You buy one for $500 or less, bolt in a roll cage, and try to keep it running for two days. Finishing is an achievement. Finishing well is suspicious.</p>
<p>We've been at it for more than ten years. In {CUR} we ran {A26['races']} race weekends, put {len(FL)} different cars on track and finished on the overall podium in Texas. We're second in the national points and leading the South.</p>
<p class="tbd">The team's own story goes here: how it started, the first car, the worst weekend. The owner writes or dictates it from the admin page.</p></div>
<dl class="facts"><div><dt>Series</dt><dd>24 Hours of Lemons</dd></div><div><dt>Racing since</dt><dd>10+ years</dd></div><div><dt>Race weekends on record</dt><dd>{ALL['races']}</dd></div><div><dt>Cars in {CUR}</dt><dd>{len(FL)}</dd></div><div><dt>National points</dt><dd>P2</dd></div><div><dt>Home base</dt><dd class="q">From the owner</dd></div></dl></section>
<section class="wrap"><div class="sechead"><div><p class="kicker">Who runs it</p><h2>Owners</h2></div></div>
<div class="people">{''.join(f"<article class='person'><div class='slot sq'>Photo</div><p class='role'>{r}</p><h3>{e(h)}</h3><p class='tbd'>{e(d)}. Name and bio from the owner.</p></article>" for h,d,r in own)}</div>
<p class="src">Only the team owner and car owners are listed. Drivers change from race to race.</p></section>"""
MIC='<span class="mic" aria-hidden="true"><svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V22h2v-3.08A7 7 0 0 0 19 12h-2Z"/></svg></span>'
P['admin']=f"""<div class="adm"><aside class="aside"><div class="abrand"><b>Half Fast</b> <span>Admin</span></div>
<nav>{''.join(f"<a class='{'on' if i==0 else ''}' href='#admin'>{x}</a>" for i,x in enumerate(['Overview','Races & reports','Cars','About the team','Gallery','Home page','People','Settings']))}</nav>
<a class="viewsite" href="#home">← View the site</a></aside>
<div class="amain"><div class="ahead"><div><p class="kicker">Mock-up · sample data</p><h1>Overview</h1></div><div class="who"><span class="av">A</span><div><b>Team owner</b><small>Signed in</small></div></div></div>
<div class="todo"><article class="tcard hot"><span class="tag">Needs you</span><h3>Race report ready: {e(last['race'])}</h3><p>The official result came in (P{lc['pos']} of {last['of']}). A draft report is written. Read it, fix it, publish it.</p><div class="acts"><a class="abtn">Review draft</a><a class="abtn ghost">Skip</a></div></article>
<article class="tcard"><span class="tag">Photos</span><h3>14 new photos to sort</h3><p>Uploaded by 2 teammates from MSR Houston. Pick the ones for the gallery.</p><div class="acts"><a class="abtn">Sort photos</a></div></article>
<article class="tcard"><span class="tag">Team</span><h3>2 car owners haven't sent their info</h3><p>Their form links are still unopened.</p><div class="acts"><a class="abtn">Send a reminder</a></div></article></div>
<div class="agrid"><section class="apanel"><div class="ph"><h2>Official results</h2><span class="ok">● Up to date</span></div>
<dl class="sync"><div><dt>Last checked</dt><dd>Mon Nov 23, 6:00 AM</dd></div><div><dt>Next check</dt><dd>Mon Nov 30</dd></div><div><dt>Races on record</dt><dd>{ALL['races']}</dd></div><div><dt>National points</dt><dd>P2 · 158</dd></div></dl>
<p class="hint">The site checks Lemons and the official timing every Monday, and the day after each race. You don't have to type results.</p><div class="acts"><a class="abtn ghost">Check now</a><a class="abtn ghost">Fix a result</a></div></section>
<section class="apanel"><div class="ph"><h2>Quick actions</h2></div><div class="quick"><a>＋ Upload photos</a><a>＋ Write a race report</a><a>＋ Add a car</a><a>＋ Invite a teammate</a><a>✎ Edit the home page</a><a>✎ Set the next race</a></div></section></div>
<section class="apanel"><div class="ph"><h2>Edit: About the team</h2><span class="saved">Saved 2 min ago</span></div>
<div class="edit"><div><label>The team's story</label><div class="ta">Tap the mic and tell it like you would in the paddock. We'll tidy the punctuation; you approve the text.{MIC}</div>
<label>Home base</label><div class="inp">City, State</div></div>
<div><label>Team photo</label><div class="drop">Drop a photo here, or tap to choose<small>Resized automatically. Phone photos are fine.</small></div></div></div>
<div class="acts"><a class="abtn">Publish</a><a class="abtn ghost">Preview</a></div></section>
<section class="apanel"><div class="ph"><h2>People</h2><a class="abtn sm">＋ Invite</a></div>
<div class="tbl plain"><table><thead><tr><th>Person</th><th>Role</th><th>Can edit</th><th>Info form</th><th>Last seen</th></tr></thead><tbody>
<tr><td><strong>Team owner</strong></td><td>Owner</td><td>Everything</td><td><span class="pill g">Done</span></td><td class="d">Today</td></tr>
<tr><td><strong>Owner of #42</strong></td><td>Car owner</td><td>Their car, photos, reports</td><td><span class="pill g">Done</span></td><td class="d">Nov 9</td></tr>
<tr><td><strong>Owner of #220</strong></td><td>Car owner</td><td>Their car, photos, reports</td><td><span class="pill y">Link sent</span></td><td class="d">Never</td></tr>
<tr><td><strong>Owner of #221</strong></td><td>Car owner</td><td>Their car, photos, reports</td><td><span class="pill y">Link sent</span></td><td class="d">Never</td></tr>
<tr><td><strong>A driver</strong></td><td>Teammate</td><td>Upload photos</td><td><span class="pill">Not needed</span></td><td class="d">Nov 8</td></tr>
</tbody></table></div></section></div></div>"""
P['gallery']=f"""<section class="pagehead"><div class="wrap"><p class="kicker">Gallery</p><h1>From the paddock</h1><p class="lede">Photos uploaded by the crew, sorted by race.</p></div></section>
<section class="wrap">{''.join(f"<div class='gal'><h3>{e(ev['race'])} <span>{e(ev['track'])} · {day(ev['date'])}</span></h3><div class='galgrid'>{'<div class=slot>Photo</div>'*4}</div></div>" for ev in years[CUR][:3])}</section>"""
NAV=[('home','Home'),('results','Results'),('cars','Cars'),('about','About'),('gallery','Gallery')]
def header(active):
    a=active.split('-')[0]
    return f"""<header class="top"><div class="wrap bar"><a class="brand" href="{L('home')}"><b>Half Fast</b><span>Racing</span></a>
<nav class="main" aria-label="Main">{''.join(f"<a href='{L(k)}' data-nav='{k}' class='{'on' if k==a else ''}'>{v}</a>" for k,v in NAV)}</nav></div></header>"""
FOOT=f"""<footer><div class="wrap fgrid"><div><a class="brand" href="{L('home')}"><b>Half Fast</b><span>Racing</span></a><p>A 24 Hours of Lemons endurance team. Built in a garage, raced on real tracks.</p></div>
<div><h4>Site</h4>{''.join(f"<a href='{L(k)}'>{v}</a>" for k,v in NAV[1:])}</div><div><h4>Data</h4><a href="https://24hoursoflemons.com/standings" target="_blank" rel="noopener">Lemons standings ↗</a><a href="https://speedhive.mylaps.com/Organizations/145414" target="_blank" rel="noopener">Official timing ↗</a></div></div>
<div class="wrap legal">© 2026 Half Fast Racing. An independent team site, not run by 24 Hours of Lemons. <a class="prev" href="#admin">Preview only: open the admin mock-up →</a></div></footer>"""
CSS=open('style2.css').read()
JS="""function tick(){document.querySelectorAll('.clock').forEach(function(c){var s=Math.max(0,new Date(c.dataset.t)-Date.now())/1e3,b=c.querySelectorAll('b');b[0].textContent=Math.floor(s/86400);b[1].textContent=String(Math.floor(s%86400/3600)).padStart(2,'0');b[2].textContent=String(Math.floor(s%3600/60)).padStart(2,'0')})}tick();setInterval(tick,30000);"""
HEAD="<title>Half Fast Racing</title>\n<meta name=\"description\" content=\"Half Fast Racing: a 24 Hours of Lemons endurance team, racing $500 cars for more than ten years.\">"
# single-file (artifact, hash views)
MULTI=False
views="".join(f"<main data-view='{k}' hidden>{v}</main>" for k,v in P.items())
ROUTE="""function route(){var h=(location.hash||'#home').slice(1),v=document.querySelector('main[data-view="'+h+'"]');if(!v){h='home';v=document.querySelector('main[data-view=home]')}document.body.classList.toggle('isadm',h==='admin');document.querySelectorAll('main').forEach(function(m){m.hidden=m!==v});document.querySelectorAll('[data-nav]').forEach(function(a){a.classList.toggle('on',a.dataset.nav===h.split('-')[0])});window.scrollTo(0,0)}addEventListener('hashchange',route);route();"""
os.makedirs('site',exist_ok=True)
open('site/half-fast-preview.html','w').write(HEAD+'\n<meta name="claude:viewport-fit-sides" content="cover">\n<style>'+CSS+'</style>\n'+header('home')+views+FOOT+'<script>'+JS+ROUTE+'</script>')
print('years',YL,'ALL',ALL,'pages',list(P))
