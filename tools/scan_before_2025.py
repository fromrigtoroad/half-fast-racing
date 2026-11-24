import json,time,urllib.request,re
A="https://eventresults-api.speedhive.com/api/v0.2.3/eventresults"
def get(u):
    r=urllib.request.Request(u,headers={"Accept":"application/json","User-Agent":"hfr-results/0.1"})
    return json.load(urllib.request.urlopen(r,timeout=30))
ev=json.load(open("events.json"))
off=200
while True:
    try: more=get(f"{A}/organizations/145414/events?count=200&offset={off}&sportCategory=Motorized")
    except Exception as x: print("ERR list",x); break
    if not more: break
    ev+=more; off+=200
json.dump(ev,open("events_all.json","w"))
ev=[e for e in ev if e.get("startDate","")<"2025-01-01"]
print("events",len(ev),ev[-1]["startDate"][:10] if ev else "",flush=True)
out=[]
for e in ev:
    try: s=get(f"{A}/events/{e['id']}/sessions")
    except Exception as x: print("ERR",e['id'],x,flush=True); continue
    sess=[]
    for g in s.get("groups",[]):
        sess+=g.get("sessions",[])+[ss for sg in g.get("subGroups",[]) for ss in sg.get("sessions",[])]
    sess+=s.get("sessions",[])
    for ss in sess:
        if (ss.get("type") or "").lower()!="race": continue
        try: c=get(f"{A}/sessions/{ss['id']}/classification")
        except Exception as x: continue
        rows=c.get("rows",[])
        for r in rows:
            if re.search(r"half.?fast",r.get("name") or "",re.I):
                out.append({"event":e["name"],"date":e["startDate"][:10],"eventId":e["id"],"session":ss.get("name"),"sessionId":ss["id"],"of":len(rows),"row":r})
                print(e["startDate"][:10],e["name"],"|",ss.get("name"),"P",r.get("position"),"of",len(rows),r.get("name"),r.get("startNumber"),r.get("numberOfLaps"),flush=True)
        time.sleep(0.15)
    json.dump(out,open("hfr_hits_old.json","w"))
print("done",len(out),flush=True)
