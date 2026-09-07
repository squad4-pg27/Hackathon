#!/usr/bin/env python3
"""Checks data/*.csv for structure, cross-file references and the presence of
every deliberate trap. Structure only: it cannot judge whether the scenarios
read as realistic, or whether the evidence key's judgements are right.

  python3 dev/validate-fixtures.py
"""
import csv, re, sys, os
import os.path
D=os.path.join(os.path.dirname(os.path.abspath(__file__)),"..","data")
def load(n):
    with open(os.path.join(D,n),newline="",encoding="utf-8") as f:
        return list(csv.DictReader(f))
req=load("requests.csv"); con=load("contacts.csv"); acc=load("accounts.csv")
notes=load("notes.csv"); inv=load("source_inventory.csv"); pri=load("prior_decisions.csv")
pv=load("priority_versions.csv"); cm=load("commitments.csv"); key=load("evidence_key.csv")
fails=[]; oks=[]
def chk(cond,msg):
    (oks if cond else fails).append(msg)

# headers exact
exp={"requests.csv":"request_id,batch,arrival,contact_id,requester_name,requester_email,org,ask_text,minutes_requested,deadline,released_late",
"contacts.csv":"contact_id,name,email,org,account_id,role,relationship_owner",
"accounts.csv":"account_id,account_name,owner,annual_value,notes",
"notes.csv":"note_id,contact_id,date,source_type,excerpt,conflict_group",
"source_inventory.csv":"source_id,note_id,contact_id,source_type,exists,retrieved",
"prior_decisions.csv":"decision_id,contact_id,date,action,reason",
"priority_versions.csv":"version,effective_date,summary",
"commitments.csv":"commitment_id,batch,minutes,description,binding",
"evidence_key.csv":"request_id,critical_fact,source_note_id,must_flag_unknown"}
for fn,h in exp.items():
    with open(os.path.join(D,fn),newline="",encoding="utf-8") as f:
        actual=f.readline().strip()
    chk(actual==h, "header %s"%fn)

cids={c["contact_id"] for c in con}; aids={a["account_id"] for a in acc}
nids={n["note_id"] for n in notes}; rids={r["request_id"] for r in req}
# uniqueness
for nm,rows,k in [("requests",req,"request_id"),("contacts",con,"contact_id"),("accounts",acc,"account_id"),
                  ("notes",notes,"note_id"),("source_inventory",inv,"source_id"),("prior_decisions",pri,"decision_id"),
                  ("priority_versions",pv,"version"),("commitments",cm,"commitment_id")]:
    ids=[r[k] for r in rows]; chk(len(ids)==len(set(ids)), "unique %s.%s"%(nm,k))
# counts
chk(len(req)==10,"exactly 10 requests (got %d)"%len(req))
for b in "AB":
    ini=[r for r in req if r["batch"]==b and r["released_late"]=="FALSE"]
    late=[r for r in req if r["batch"]==b and r["released_late"]=="TRUE"]
    chk(len(ini)==4,"batch %s has 4 initial (got %d)"%(b,len(ini)))
    chk(len(late)==1,"batch %s has 1 late (got %d)"%(b,len(late)))
# refs
for r in req:
    if r["contact_id"]: chk(r["contact_id"] in cids,"request %s contact ref"%r["request_id"])
    m=int(r["minutes_requested"]); chk(15<=m<=90 and str(m)==r["minutes_requested"],"request %s minutes 15-90 whole"%r["request_id"])
    chk(re.fullmatch(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}",r["arrival"]) is not None,"request %s arrival ISO"%r["request_id"])
    chk(re.fullmatch(r"\d{4}-\d{2}-\d{2}",r["deadline"]) is not None,"request %s deadline ISO"%r["request_id"])
    chk(r["released_late"] in ("TRUE","FALSE"),"request %s bool"%r["request_id"])
    s=len(re.findall(r"[.!?](?:\s|$)",r["ask_text"])); chk(2<=s<=4,"request %s 2-4 sentences (got %d)"%(r["request_id"],s))
for c in con:
    if c["account_id"]: chk(c["account_id"] in aids,"contact %s account ref"%c["contact_id"])
for n in notes:
    chk(n["contact_id"] in cids,"note %s contact ref"%n["note_id"])
    chk(n["source_type"] in ("crm","email","meeting_note"),"note %s source_type"%n["note_id"])
    chk(re.fullmatch(r"\d{4}-\d{2}-\d{2}",n["date"]) is not None,"note %s date ISO"%n["note_id"])
for p in pri: chk(p["contact_id"] in cids,"prior_decision %s contact ref"%p["decision_id"])
for k in key:
    chk(k["request_id"] in rids,"key request ref %s"%k["request_id"])
    if k["source_note_id"]: chk(k["source_note_id"] in nids,"key note ref %s"%k["source_note_id"])
    chk(k["must_flag_unknown"] in ("TRUE","FALSE"),"key bool")
# inventory rules
noteref={}
for s in inv:
    chk(s["exists"] in ("TRUE","FALSE") and s["retrieved"] in ("TRUE","FALSE"),"inv %s bools"%s["source_id"])
    chk(s["contact_id"] in cids,"inv %s contact ref"%s["source_id"])
    if s["retrieved"]=="TRUE":
        chk(s["exists"]=="TRUE","inv %s retrieved implies exists"%s["source_id"])
        chk(s["note_id"] in nids,"inv %s retrieved has valid note"%s["source_id"])
        noteref[s["note_id"]]=noteref.get(s["note_id"],0)+1
        n=[x for x in notes if x["note_id"]==s["note_id"]][0]
        chk(n["contact_id"]==s["contact_id"] and n["source_type"]==s["source_type"],"inv %s matches note fields"%s["source_id"])
    else:
        chk(s["note_id"]=="","inv %s unretrieved has blank note_id"%s["source_id"])
for n in notes:
    chk(noteref.get(n["note_id"],0)==1,"note %s referenced by exactly one retrieved source"%n["note_id"])
chk(any(s["exists"]=="TRUE" and s["retrieved"]=="FALSE" for s in inv),"has exists-but-unretrieved source")
chk(any(s["exists"]=="FALSE" for s in inv),"has non-existent source")
# commitments
for b in "AB":
    tot=sum(int(c["minutes"]) for c in cm if c["batch"]==b)
    oks.append("batch %s fixed commitments total %d min (context only, not deducted from 120)"%(b,tot))
for c in cm: chk(c["binding"] in ("TRUE","FALSE"),"commitment %s bool"%c["commitment_id"])
# traps
names={}
for c in con: names.setdefault(c["name"],[]).append(c["contact_id"])
dupe=[ (k,v) for k,v in names.items() if len(v)>1 ]
chk(len(dupe)==1 and len(dupe[0][1])==2,"exactly one shared full name: %s"%dupe)
emails={c["email"] for c in con}
for r in req:
    if not r["contact_id"]:
        chk(r["requester_email"] not in emails,"unresolved request %s email does not match a contact"%r["request_id"])
chk(any("IGNORE PREVIOUS INSTRUCTIONS" in r["ask_text"] for r in req),"injection text in a request")
chk(any("IGNORE PREVIOUS INSTRUCTIONS" in n["excerpt"] for n in notes),"injection text in a note")
chk(any("<script>alert(1)</script>" in r["ask_text"] for r in req),"literal markup in a request")
chk(any("<script>alert(1)</script>" in n["excerpt"] for n in notes),"literal markup in a note")
chk(any("\n" in n["excerpt"] for n in notes),"multiline excerpt present")
chk(any('"' in n["excerpt"] for n in notes),"excerpt with embedded quotes present")
cg={}
for n in notes:
    if n["conflict_group"]: cg.setdefault(n["conflict_group"],[]).append(n["note_id"])
chk(len(cg)>=2 and all(len(v)>=2 for v in cg.values()),"conflict groups: %s"%cg)
from datetime import date
old=[n["note_id"] for n in notes if n["date"]<"2025-03-07"]
chk(len(old)>=1,"note older than 18 months (before 2025-03-07): %s"%old)
declined={p["contact_id"] for p in pri if p["action"]=="declined"}
repeat=[r["request_id"] for r in req if r["contact_id"] in declined]
chk(len(repeat)>=1,"repeat request(s) after a prior decline: %s"%repeat)
# batch minutes
for b in "AB":
    ini=sum(int(r["minutes_requested"]) for r in req if r["batch"]==b and r["released_late"]=="FALSE")
    late=sum(int(r["minutes_requested"]) for r in req if r["batch"]==b and r["released_late"]=="TRUE")
    oks.append("batch %s asks: initial %d min, late %d min, total %d vs 120 capacity"%(b,ini,late,ini+late))
# key coverage
kr={k["request_id"] for k in key}
chk(kr==rids,"evidence key covers every request")

print("== FAILURES (%d) =="%len(fails))
for f in fails: print("  FAIL:",f)
print("== checks passed: %d =="%len(oks))
for o in oks:
    if "min" in o and ("asks" in o or "commitments" in o) or "conflict groups" in o or "18 months" in o or "shared full name" in o or "decline" in o: print("  ",o)
sys.exit(1 if fails else 0)
