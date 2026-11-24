import json,sys,time,urllib.request,re
A="https://eventresults-api.speedhive.com/api/v0.2.3/eventresults"
def get(u):
    r=urllib.request.Request(u,headers={"Accept":"application/json","User-Agent":"hfr-results/0.1"})
    return json.load(urllib.request.urlopen(r,timeout=30))
ev=json.load(open("events.json"))
ev=[e for e in ev if e.get("startDate","")>="2025-01-01"]
out=[]
for e in ev:
    try: s=get(f"{A}/events/{e['id']}/sessions")
    except Exception as x: print("ERR",e['id'],x); continue
    sess=[]
    for g in s.get("groups",[]):
        sess+=g.get("sessions",[])+[ss for sg in g.get("subGroups",[]) for ss in sg.get("sessions",[])]
    sess+=s.get("sessions",[])
    if e is ev[0]: print("SESSION KEYS",list(s.keys()), sess[:1])
    for ss in sess:
        if (ss.get("type") or "").lower()!="race": continue
        try: c=get(f"{A}/sessions/{ss['id']}/classification")
        except Exception as x: print("ERR cls",ss['id'],x); continue
        rows=c.get("rows",[])
        for r in rows:
            if re.search(r"half.?fast",json.dumps(r),re.I):
                out.append({"event":e["name"],"date":e["startDate"][:10],"eventId":e["id"],"session":ss.get("name"),"sessionId":ss["id"],"of":len(rows),"row":r})
                print(e["startDate"][:10],e["name"],ss.get("name"),"P",r.get("position"),"of",len(rows),r.get("name"),r.get("startNumber"),r.get("numberOfLaps"),r.get("bestLap"))
        time.sleep(0.3)
json.dump(out,open("hfr_hits.json","w"),indent=1)
print("done",len(out))
