"""HOLYDJO MARKET — API QA suite. Usage: python3 docs/qa/qa_api.py http://localhost:4001 [results.json]
Run against a LOCAL API with freshly seeded demo data (npm run db:seed). Never against production."""
import json, sys, time, uuid, urllib.request, urllib.error

A = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:4013"
RESULTS = []


def req(method, path, body=None, token=None, headers=None, raw=None, ctype="application/json"):
    data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
    h = {"Content-Type": ctype} if data is not None else {}
    if token:
        h["Authorization"] = f"Bearer {token}"
    h.update(headers or {})
    r = urllib.request.Request(A + path, data=data, method=method, headers=h)
    try:
        with urllib.request.urlopen(r, timeout=30) as resp:
            txt = resp.read().decode()
            return resp.status, (json.loads(txt) if txt else None), dict(resp.headers)
    except urllib.error.HTTPError as e:
        txt = e.read().decode()
        try:
            return e.code, json.loads(txt), dict(e.headers)
        except Exception:
            return e.code, txt, dict(e.headers)


def check(area, name, ok, detail=""):
    RESULTS.append({"area": area, "name": name, "ok": bool(ok), "detail": detail})
    print(("  ✅ " if ok else "  ❌ ") + f"[{area}] {name}" + (f" — {detail}" if not ok and detail else ""))


def login(email, pw="Demo1234!"):
    s, b, _ = req("POST", "/auth/login", {"email": email, "password": pw})
    return b.get("token") if s in (200, 201) else None


def verify_email(email):
    """Confirms an account like a user clicking the link: reads the token from the
    "confirmez votre adresse" email stored in the local outbox (EmailOutbox)."""
    import re, subprocess, time as _t
    for _ in range(10):
        out = subprocess.run(["psql", "-d", "holydo_market", "-tAc",
            "select text from \"EmailOutbox\" where '" + email + "' = any(\"to\") and subject like '%confirmez%' order by \"createdAt\" desc limit 1"],
            capture_output=True, text=True).stdout
        m = re.search(r"token=([A-Za-z0-9_%-]+)", out)
        if m:
            from urllib.parse import unquote
            return req("POST", "/auth/verify-email", {"token": unquote(m.group(1))})
        _t.sleep(0.5)
    return (0, None, {})


def multipart_png(fname="x.png", ctype="image/png", payload=None):
    boundary = uuid.uuid4().hex
    import struct, zlib
    if payload is None:
        raw = b"".join(b"\x00" + bytes([200, 80, 42]) * 8 for _ in range(6))
        c = lambda t, d: struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d))
        payload = b"\x89PNG\r\n\x1a\n" + c(b"IHDR", struct.pack(">IIBBBBB", 8, 6, 8, 2, 0, 0, 0)) + c(b"IDAT", zlib.compress(raw)) + c(b"IEND", b"")
    body = (f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{fname}\"\r\nContent-Type: {ctype}\r\n\r\n").encode() + payload + f"\r\n--{boundary}--\r\n".encode()
    return body, f"multipart/form-data; boundary={boundary}"


# ---------------------------------------------------------------- setup
ADMIN, CLIENT, AWA, NADEGE = login("admin@holydo.test"), login("client@holydo.test"), login("awa@holydo.test"), login("nadege@holydo.test")
check("setup", "logins démo", all([ADMIN, CLIENT, AWA, NADEGE]))
cats = req("GET", "/categories")[1]
cat = {c["slug"]: c["id"] for c in cats}

# ---------------------------------------------------------------- A. client
print("== A. Parcours client")
s, b, _ = req("GET", "/providers/search?category=braids&place=Montr%C3%A9al-Nord")
check("client", "recherche catégorie + quartier", s == 200 and b["total"] >= 1 and b["center"]["label"] == "Montréal-Nord")
check("client", "résultats triés par distance", all(b["results"][i]["distanceKm"] <= b["results"][i + 1]["distanceKm"] for i in range(len(b["results"]) - 1)))
s, b, _ = req("GET", "/providers/search?lat=45.4589&lng=-73.5707&radiusKm=5")
check("client", "recherche GPS + rayon 5 km", s == 200 and all(r["distanceKm"] <= 5 or r["comesToYou"] for r in b["results"]))
s, b, _ = req("GET", "/providers/search?kind=BUSINESS")
check("client", "filtre entreprise", s == 200 and b["total"] > 0 and all(r["kind"] == "BUSINESS" for r in b["results"]))
s, b, _ = req("GET", "/providers/search?mode=travels")
check("client", "filtre se déplace", all(r["modes"]["travels"] for r in b["results"]) and b["total"] > 0)
s, b, _ = req("GET", "/providers/search?maxPrice=30")
check("client", "filtre prix max 30 $", b["total"] > 0 and all(r["priceFromCents"] <= 3000 for r in b["results"]))
s, b, _ = req("GET", "/providers/search?sort=price")
prices = [r["priceFromCents"] for r in b["results"]]
check("client", "tri prix croissant", prices == sorted(prices))
s, b, _ = req("GET", "/providers/search?sort=rating")
rat = [r["ratingAvg"] for r in b["results"]]
check("client", "tri mieux notés", rat == sorted(rat, reverse=True))
s, b, _ = req("GET", "/providers/search?category=moving&place=Brossard&radiusKm=3")
check("client", "aucun résultat → liste vide propre", s == 200 and isinstance(b["results"], list))
s, b, _ = req("GET", "/providers/search?q=tresses")
check("client", "mot-clé « tresses » trouve les tresseuses", b["total"] >= 2, f"{b['total']} résultat(s) : {[r['displayName'] for r in b['results']]}")
s, b, _ = req("GET", "/providers/search?q=coiffeuse")
check("client", "mot-clé « coiffeuse » (dans la description) trouve un résultat", b["total"] >= 1, f"{b['total']} résultat(s)")
s, b, _ = req("GET", "/providers/search?radiusKm=999")
check("client", "rayon hors limites refusé (400)", s == 400)
s, b, _ = req("GET", "/providers/search?place=Zzzzqqq")
check("client", "lieu inconnu → pas d'erreur", s == 200, f"total={b.get('total') if isinstance(b, dict) else b}")
s, b, _ = req("GET", "/providers/tresses-by-awa")
check("client", "profil complet (photos, services, horaires, avis)", s == 200 and b["photos"] and b["services"] and len(b["openingHours"]) == 7 and b["reviews"])
check("client", "profil : userId non exposé", "userId" not in b)
check("client", "profil à domicile : adresse exacte masquée", b.get("address") is None)
s, b, _ = req("GET", "/providers/nappy-queen-studio")
check("client", "profil en attente invisible (404)", s == 404)
s, b, _ = req("GET", "/providers/n-existe-pas")
check("client", "profil inexistant → 404", s == 404)
prof = req("GET", "/providers/salon-kalinda")[1]
future = time.strftime("%Y-%m-%dT15:00:00.000Z", time.gmtime(time.time() + 5 * 86400))
s, b, _ = req("POST", "/appointments", {"profileId": prof["id"], "serviceId": prof["services"][0]["id"], "requestedAt": future, "message": "Bonjour"}, CLIENT)
check("client", "demande de rendez-vous", s == 201 and b["status"] == "PENDING")
APPT = b.get("id") if isinstance(b, dict) else None
s, b, _ = req("POST", "/appointments", {"profileId": prof["id"], "requestedAt": future})
check("client", "rendez-vous sans compte → 401", s == 401)
s, b, _ = req("POST", "/appointments", {"profileId": prof["id"], "requestedAt": "2020-01-01T10:00:00.000Z"}, CLIENT)
check("client", "date passée refusée", s == 400)
s, b, _ = req("POST", "/appointments", {"profileId": prof["id"], "requestedAt": "9999-01-01T10:00:00.000Z"}, CLIENT)
check("client", "date dans 8000 ans refusée", s == 400, f"statut {s}")
s, b, _ = req("POST", "/appointments", {"profileId": prof["id"], "requestedAt": future, "serviceId": req("GET", "/providers/tresses-by-awa")[1]["services"][0]["id"]}, CLIENT)
check("client", "service d'un autre prestataire refusé", s == 400)
s, b, _ = req("POST", "/appointments", {"profileId": prof["id"], "requestedAt": "pas-une-date"}, CLIENT)
check("client", "date invalide refusée", s == 400)
s, b, _ = req("GET", "/appointments/mine", token=CLIENT)
check("client", "mes demandes", s == 200 and any(a["id"] == APPT for a in b))
s, b, _ = req("POST", "/reviews", {"profileId": prof["id"], "rating": 5}, CLIENT)
check("client", "avis sans rendez-vous accepté refusé", s == 400)

# ---------------------------------------------------------------- B. prestataire
print("== B. Parcours prestataire")
em = f"qa.pro.{uuid.uuid4().hex[:6]}@holydo.test"
s, b, _ = req("POST", "/auth/register", {"email": em, "password": "Demo1234!", "firstName": "Qa", "lastName": "Pro", "role": "PROVIDER", "acceptTerms": True})
PRO = b.get("token") if isinstance(b, dict) else None
check("prestataire", "inscription prestataire", s == 201 and b["user"]["role"] == "PROVIDER")
check("H4", "nouveau compte : email non confirmé", b["user"].get("emailVerified") is False)
s, b, _ = req("POST", "/auth/register", {"email": em, "password": "Demo1234!", "firstName": "Qa", "lastName": "Pro", "role": "PROVIDER", "acceptTerms": True})
check("prestataire", "email déjà utilisé refusé (409)", s == 409)
s, b, _ = req("GET", "/me/profile", token=PRO)
check("prestataire", "pas encore de profil → null", s == 200 and b is None)
s, b, _ = req("PUT", "/me/profile", {"displayName": "QA Coiffure", "kind": "INDEPENDENT"}, PRO)
check("prestataire", "création sans lieu refusée", s == 400)
s, b, _ = req("PUT", "/me/profile", {"displayName": "QA Coiffure", "kind": "INDEPENDENT", "neighbourhood": "Verdun", "atHome": True, "status": "APPROVED", "ratingAvg": 5, "ratingCount": 99, "slug": "hack"}, PRO)
check("prestataire", "création profil (champs interdits ignorés)", s == 200 and b["status"] == "DRAFT" and b["ratingCount"] == 0 and b["slug"] != "hack", f"status={b.get('status')} rating={b.get('ratingCount')} slug={b.get('slug')}")
QPID = b.get("id")
check("prestataire", "fuseau horaire calculé", b.get("timeZone") == "America/Toronto")
s, b, _ = req("POST", "/me/profile/submit", token=PRO)
check("H4", "soumission refusée tant que l'email n'est pas confirmé (403)", s == 403 and "Confirmez" in b.get("message", ""))
s, b, _ = verify_email(em)
check("H4", "lien de confirmation → compte confirmé + connecté", s == 201 and b["user"]["emailVerified"] is True)
PRO = b["token"]
s, b, _ = verify_email(em)
check("H4", "lien de confirmation à usage unique", s in (0, 400))
s, b, _ = req("POST", "/me/profile/submit", token=PRO)
check("prestataire", "soumission incomplète refusée avec la liste", s == 400 and "description" in b["message"] and "service" in b["message"] and "photo" in b["message"])
s, b, _ = req("POST", "/me/profile/services", {"categoryId": cat["hair"], "name": "Coupe", "priceCents": -500}, PRO)
check("prestataire", "prix négatif refusé", s == 400)
s, b, _ = req("POST", "/me/profile/services", {"categoryId": cat["hair"], "name": "Coupe", "priceCents": 4500, "durationMin": 45}, PRO)
check("prestataire", "ajout service", s == 201)
SVC = b.get("id")
s, b, _ = req("PUT", f"/me/profile/services/{SVC}", {"categoryId": cat["hair"], "name": "Coupe femme", "priceCents": 5500}, PRO)
check("prestataire", "modification nom + prix", s == 200 and b["priceCents"] == 5500)
s, b, _ = req("POST", "/me/profile/services", {"categoryId": cat["braids"], "name": "Tresses", "priceCents": 9000}, PRO)
S2 = b.get("id")
s, b, _ = req("DELETE", f"/me/profile/services/{S2}", token=PRO)
check("prestataire", "suppression service", s == 200)
body, ct = multipart_png()
s, b, _ = req("POST", "/me/profile/photos", raw=body, ctype=ct, token=PRO)
check("prestataire", "envoi photo PNG", s == 201)
body, ct = multipart_png("x.gif", "image/gif")
s, b, _ = req("POST", "/me/profile/photos", raw=body, ctype=ct, token=PRO)
check("prestataire", "format GIF refusé", s == 400)
body, ct = multipart_png("evil.html", "image/png", b"<html><script>alert(document.domain)</script></html>")
s, b, _ = req("POST", "/me/profile/photos", raw=body, ctype=ct, token=PRO)
evil_url = b.get("url") if isinstance(b, dict) else None
served = None
if s == 201 and evil_url:
    try:
        with urllib.request.urlopen(A + evil_url) as r:
            served = r.headers.get("Content-Type")
    except Exception as e:
        served = str(e)
check("H1", "fichier HTML déguisé en PNG refusé", s == 400, f"accepté ({s}) → servi à {evil_url} avec Content-Type « {served} »")
PHOTO_EVIL = b.get("id") if isinstance(b, dict) else None
if PHOTO_EVIL:
    req("DELETE", f"/me/profile/photos/{PHOTO_EVIL}", token=PRO)
body, ct = multipart_png("photo.html", "image/png")
s, b, _ = req("POST", "/me/profile/photos", raw=body, ctype=ct, token=PRO)
check("H1", "vrai PNG nommé .html → enregistré en .png", s == 201 and b["url"].endswith(".png"), str(b)[:80])
if s == 201:
    with urllib.request.urlopen(A + b["url"]) as r:
        check("H1", "fichiers /uploads servis avec CSP « sandbox » et nosniff", "sandbox" in (r.headers.get("Content-Security-Policy") or "") and r.headers.get("X-Content-Type-Options") == "nosniff")
    req("DELETE", f"/me/profile/photos/{b['id']}", token=PRO)
jpg = b"\xff\xd8\xff\xe0" + b"\x00" * 64
body, ct = multipart_png("x.jpg", "image/jpeg", jpg)
s, b, _ = req("POST", "/me/profile/photos", raw=body, ctype=ct, token=PRO)
check("H1", "JPEG reconnu par sa signature", s == 201 and b["url"].endswith(".jpg"))
if s == 201: req("DELETE", f"/me/profile/photos/{b['id']}", token=PRO)
webp = b"RIFF" + b"\x00\x00\x00\x00" + b"WEBP" + b"\x00" * 32
body, ct = multipart_png("x.webp", "image/webp", webp)
s, b, _ = req("POST", "/me/profile/photos", raw=body, ctype=ct, token=PRO)
check("H1", "WEBP reconnu par sa signature", s == 201 and b["url"].endswith(".webp"))
if s == 201: req("DELETE", f"/me/profile/photos/{b['id']}", token=PRO)
s, b, _ = req("PUT", "/me/profile/hours", {"days": [{"weekday": 1, "closed": False, "opensAt": "18:00", "closesAt": "09:00"}]}, PRO)
check("prestataire", "horaires : fermeture avant ouverture refusée", s == 400, f"statut {s}")
s, b, _ = req("PUT", "/me/profile/hours", {"days": [{"weekday": 1, "closed": True}, {"weekday": 1, "closed": True}]}, PRO)
check("prestataire", "horaires : jour en double → erreur propre (400)", s == 400, f"statut {s} {str(b)[:80]}")
s, b, _ = req("PUT", "/me/profile/hours", {"days": [{"weekday": d, "closed": d == 0, **({} if d == 0 else {"opensAt": "09:00", "closesAt": "17:00"})} for d in range(7)]}, PRO)
check("prestataire", "horaires valides", s == 200 and len(b) == 7)
req("PUT", "/me/profile", {"description": "Coiffeuse à domicile depuis dix ans, cheveux bouclés et crépus."}, PRO)
s, b, _ = req("POST", "/me/profile/submit", token=PRO)
check("prestataire", "soumission complète → en attente", s == 201 and b["status"] == "PENDING")
s, b, _ = req("GET", f"/providers/{req('GET', '/me/profile', token=PRO)[1]['slug']}")
check("prestataire", "invisible au public avant approbation", s == 404)
QSLUG = req("GET", "/me/profile", token=PRO)[1]["slug"]
s, b, _ = req("GET", f"/providers/{QSLUG}", token=PRO)
check("prestataire", "aperçu visible par le propriétaire", s == 200 and b["isPreview"])

# ---------------------------------------------------------------- C. admin
print("== C. Parcours admin")
s, b, _ = req("GET", "/admin/providers?status=PENDING", token=ADMIN)
check("admin", "file d'attente contient le nouveau profil", any(p["id"] == QPID for p in b))
s, b, _ = req("POST", f"/admin/providers/{QPID}/reject", {"reason": "ok"}, ADMIN)
check("admin", "refus avec raison trop courte refusé", s == 400)
s, b, _ = req("POST", f"/admin/providers/{QPID}/reject", {"reason": "Ajoutez une vraie photo de vos réalisations."}, ADMIN)
check("admin", "refus avec message", s == 201 and b["status"] == "REJECTED")
s, b, _ = req("GET", "/me/profile", token=PRO)
check("admin", "prestataire voit le message de refus", b["rejectionReason"].startswith("Ajoutez"))
req("POST", "/me/profile/submit", token=PRO)
s, b, _ = req("POST", f"/admin/providers/{QPID}/approve", token=ADMIN)
check("admin", "approbation", s == 201 and b["status"] == "APPROVED")
s, b, _ = req("GET", "/providers/search?q=QA%20Coiffure")
check("admin", "profil approuvé visible dans la recherche", any(r["id"] == QPID for r in b["results"]))
s, b, _ = req("PUT", "/me/profile", {"displayName": "QA Coiffure Pro"}, PRO)
check("admin", "renommage d'un profil publié → retour en attente", b["status"] == "PENDING")
req("POST", f"/admin/providers/{QPID}/approve", token=ADMIN)
s, b, _ = req("POST", f"/admin/providers/{QPID}/reject", {"reason": "Suspension temporaire pour vérification."}, ADMIN)
check("admin", "suspendre un profil publié", b["status"] == "REJECTED")
s, b, _ = req("GET", f"/providers/{QSLUG}")
check("admin", "profil suspendu invisible", s == 404)
s, b, _ = req("POST", f"/admin/providers/{QPID}/approve", token=ADMIN)
check("admin", "réactiver", b["status"] == "APPROVED")
s, b, _ = req("GET", "/admin/stats", token=ADMIN)
check("admin", "statistiques", s == 200 and "openReports" in b)

# ---------------------------------------------------------------- D. rendez-vous côté prestataire + avis
print("== D. Demandes et avis")
s, b, _ = req("GET", "/appointments/received", token=NADEGE)
mine = [a for a in b if a["id"] == APPT]
check("rdv", "le prestataire reçoit la demande", len(mine) == 1)
check("rdv", "email du client masqué avant acceptation", mine and mine[0]["customer"]["email"] == "")
s, b, _ = req("PATCH", f"/appointments/{APPT}", {"status": "ACCEPTED"}, AWA)
check("sécurité", "un autre prestataire ne peut pas accepter", s == 403)
s, b, _ = req("PATCH", f"/appointments/{APPT}", {"status": "ACCEPTED"}, CLIENT)
check("sécurité", "le client ne peut pas s'auto-accepter", s == 403)
s, b, _ = req("PATCH", f"/appointments/{APPT}", {"status": "ACCEPTED", "providerNote": "À bientôt"}, NADEGE)
check("rdv", "acceptation", s == 200 and b["status"] == "ACCEPTED")
s, b, _ = req("GET", "/appointments/received", token=NADEGE)
check("rdv", "email du client visible après acceptation", [a for a in b if a["id"] == APPT][0]["customer"]["email"] == "client@holydo.test")
s, b, _ = req("PATCH", f"/appointments/{APPT}", {"status": "DECLINED"}, NADEGE)
check("rdv", "réponse déjà donnée → refus de la modifier", s == 400)
s, b, _ = req("POST", "/reviews", {"profileId": prof["id"], "rating": 6}, CLIENT)
check("avis", "note 6/5 refusée", s == 400)
s, b, _ = req("POST", "/reviews", {"profileId": prof["id"], "rating": 4, "comment": "Très bien"}, CLIENT)
check("avis", "avis après rendez-vous accepté", s == 201)
s, b, _ = req("POST", "/reviews", {"profileId": prof["id"], "rating": 5, "comment": "Encore mieux"}, CLIENT)
n = len([r for r in req("GET", "/providers/salon-kalinda")[1]["reviews"] if r["author"]["firstName"] == "Inès"])
check("avis", "un seul avis par client (mise à jour)", n == 1)

# ---------------------------------------------------------------- E. sécurité / permissions
print("== E. Sécurité et permissions")
awa_svc = req("GET", "/me/profile", token=AWA)[1]["services"][0]["id"]
s, b, _ = req("PUT", f"/me/profile/services/{awa_svc}", {"categoryId": cat["hair"], "name": "Piraté", "priceCents": 1}, NADEGE)
check("sécurité", "modifier le service d'un autre prestataire → 403", s == 403)
s, b, _ = req("DELETE", f"/me/profile/services/{awa_svc}", token=NADEGE)
check("sécurité", "supprimer le service d'un autre → 403", s == 403)
awa_photo = req("GET", "/me/profile", token=AWA)[1]["photos"][0]["id"]
s, b, _ = req("DELETE", f"/me/profile/photos/{awa_photo}", token=NADEGE)
check("sécurité", "supprimer la photo d'un autre → refus", s in (403, 404))
s, b, _ = req("GET", "/me/profile", token=CLIENT)
check("sécurité", "client → espace prestataire 403", s == 403)
for path in ["/admin/stats", "/admin/users", "/admin/providers", "/admin/emails", "/admin/reports", "/admin/categories/pending"]:
    s, b, _ = req("GET", path, token=AWA)
    check("sécurité", f"prestataire → {path} 403", s == 403)
s, b, _ = req("GET", "/admin/stats")
check("sécurité", "admin sans connexion → 401", s == 401)
forged = ADMIN[:-4] + ("AAAA" if not ADMIN.endswith("AAAA") else "BBBB")
s, b, _ = req("GET", "/auth/me", token=forged)
check("sécurité", "jeton falsifié → 401", s == 401)
import base64
hdr = base64.urlsafe_b64encode(b'{"alg":"none","typ":"JWT"}').rstrip(b"=").decode()
pl = base64.urlsafe_b64encode(json.dumps({"sub": "x", "email": "a@b.c", "role": "ADMIN"}).encode()).rstrip(b"=").decode()
s, b, _ = req("GET", "/admin/stats", token=f"{hdr}.{pl}.")
check("sécurité", "jeton « alg:none » refusé", s == 401)
s, b, _ = req("POST", "/auth/register", {"email": "x" + uuid.uuid4().hex[:5] + "@holydo.test", "password": "Demo1234!", "firstName": "X", "lastName": "Y", "role": "ADMIN", "acceptTerms": True})
check("sécurité", "inscription en ADMIN refusée", s == 400)
s, b, _ = req("PATCH", "/auth/me", {"role": "ADMIN", "email": "pirate@x.com"}, CLIENT)
check("sécurité", "changer son rôle/email via Mon compte ignoré", s == 200 and b["role"] == "CUSTOMER" and b["email"] == "client@holydo.test")
s, b, h = req("GET", "/health")
check("sécurité", "en-têtes de sécurité (nosniff, HSTS, frame)", h.get("X-Content-Type-Options") == "nosniff" and "Strict-Transport-Security" in h and "X-Frame-Options" in h)
check("sécurité", "en-tête X-Powered-By masqué", "X-Powered-By" not in h)
s, b, _ = req("POST", "/auth/forgot-password", {"email": "inconnu@holydo.test"})
s2, b2, _ = req("POST", "/auth/forgot-password", {"email": "client@holydo.test"})
check("sécurité", "mot de passe oublié : même réponse (pas de fuite d'emails)", b == b2)
s, b, _ = req("POST", "/auth/reset-password", {"token": "x" * 43, "password": "Nouveau123!"})
check("sécurité", "lien de réinitialisation bidon refusé", s == 400)
s, b, _ = req("POST", "/auth/login", {"email": "client@holydo.test", "password": "mauvais"})
s2, b2, _ = req("POST", "/auth/login", {"email": "inconnu@holydo.test", "password": "mauvais"})
check("sécurité", "connexion : même message email inconnu / mauvais mot de passe", b.get("message") == b2.get("message"))
s, b, _ = req("GET", "/providers/search?q=%27%3B%20DROP%20TABLE%20%22User%22%3B--")
check("sécurité", "injection SQL dans la recherche sans effet", s == 200 and login("admin@holydo.test") is not None)

# ---------------------------------------------------------------- F. validation des formulaires
print("== F. Validation")
cases = [
    ({"email": "pas-un-email", "password": "Demo1234!", "firstName": "A", "lastName": "B", "role": "CUSTOMER", "acceptTerms": True}, "email invalide"),
    ({"email": "ok@holydo.test", "password": "court", "firstName": "A", "lastName": "B", "role": "CUSTOMER", "acceptTerms": True}, "mot de passe trop court"),
    ({"email": "ok@holydo.test", "password": "Demo1234!", "firstName": "", "lastName": "B", "role": "CUSTOMER", "acceptTerms": True}, "prénom vide"),
    ({"email": "ok@holydo.test", "password": "Demo1234!", "firstName": "A", "lastName": "B", "role": "CUSTOMER"}, "conditions non acceptées"),
    ({"email": "ok@holydo.test", "password": "Demo1234!", "firstName": "A", "lastName": "B", "role": "CUSTOMER", "acceptTerms": True, "phone": "123"}, "téléphone invalide"),
]
for body, label in cases:
    s, b, _ = req("POST", "/auth/register", body)
    msg = b.get("message") if isinstance(b, dict) else ""
    msg = msg[0] if isinstance(msg, list) else msg
    check("validation", f"inscription : {label} → 400 + message", s == 400 and msg, f"message : {msg}")
s, b, _ = req("POST", "/auth/register", {"email": "  MAJ.Espaces@HolyDo.TEST ", "password": "Demo1234!", "firstName": "A", "lastName": "B", "role": "CUSTOMER", "acceptTerms": True})
check("validation", "email avec espaces/majuscules accepté et normalisé", s == 201 and b["user"]["email"] == "maj.espaces@holydo.test", f"statut {s} : {str(b)[:100]}")
s, b, _ = req("POST", "/auth/register", {"email": "longnom@holydo.test", "password": "Demo1234!", "firstName": "A" * 5000, "lastName": "B", "role": "CUSTOMER", "acceptTerms": True})
check("validation", "prénom de 5000 caractères refusé à l'inscription", s == 400, f"statut {s}")
s, b, _ = req("POST", "/auth/register", {"email": "unicode@holydo.test", "password": "Demo1234!", "firstName": "<script>alert(1)</script>", "lastName": "Ñandú", "role": "CUSTOMER", "acceptTerms": True})
check("validation", "nom avec balises <script> accepté tel quel (React échappe à l'affichage)", s == 201)

# ---------------------------------------------------------------- G. limites
print("== G. Limites")
s, b, _ = req("POST", "/me/profile/services", {"categoryId": cat["nails"], "name": "Manucure", "priceCents": 3000}, PRO)
s, b, _ = req("POST", "/me/profile/services", {"categoryId": cat["cleaning"], "name": "Ménage", "priceCents": 3000}, PRO)
check("limites", "3e catégorie refusée pour un indépendant", s == 400)
s, b, _ = req("POST", "/me/categories", {"name": " coiffure "}, PRO)
check("limites", "catégorie en double réutilisée", s == 201 and b["status"] == "APPROVED")

# ---------------------------------------------------------------- H2. limite de connexion
print("== H2. Limite de connexion")
codes = [req("POST", "/auth/login", {"email": "jade@holydo.test", "password": "Demo1234!"})[0] for _ in range(15)]
check("H2", "15 connexions réussies de suite depuis la même IP → jamais bloqué", all(c in (200, 201) for c in codes), str(codes))
fails = [req("POST", "/auth/login", {"email": "amina@holydo.test", "password": "mauvais"})[0] for _ in range(5)]
s, b, _ = req("POST", "/auth/login", {"email": "amina@holydo.test", "password": "Demo1234!"})
check("H2", "5 échecs sur un compte → compte temporairement protégé (429)", fails == [401] * 5 and s == 429, f"{fails} puis {s}")
check("H2", "message clair qui propose « Mot de passe oublié »", "Mot de passe oublié" in (b.get("message") if isinstance(b, dict) else ""))
s, b, _ = req("POST", "/auth/login", {"email": "jade@holydo.test", "password": "Demo1234!"})
check("H2", "les autres comptes de la même IP ne sont pas bloqués", s in (200, 201))

# ---------------------------------------------------------------- H4. vérification de l'email
print("== H4. Vérification de l'email")
em2 = f"qa.client.{uuid.uuid4().hex[:6]}@holydo.test"
s, b, _ = req("POST", "/auth/register", {"email": em2, "password": "Demo1234!", "firstName": "Nouveau", "lastName": "Client", "role": "CUSTOMER", "acceptTerms": True})
NEWC = b.get("token")
s, b, _ = req("POST", "/appointments", {"profileId": prof["id"], "requestedAt": future}, NEWC)
check("H4", "client non confirmé : demande de rendez-vous refusée (403)", s == 403)
s, b, _ = req("POST", "/reports", {"targetType": "PROFILE", "targetId": prof["id"], "reason": "other"}, NEWC)
check("H4", "client non confirmé : signalement refusé (403)", s == 403)
s, b, _ = req("POST", "/auth/resend-verification", token=NEWC)
check("H4", "renvoyer le lien", s == 201 and em2 in b["message"])
s, b, _ = verify_email(em2)
NEWC = b["token"] if isinstance(b, dict) else NEWC
s, b, _ = req("POST", "/appointments", {"profileId": prof["id"], "requestedAt": future}, NEWC)
check("H4", "après confirmation : demande acceptée", s == 201)
s, b, _ = req("POST", "/auth/verify-email", {"token": "x" * 43})
check("H4", "lien de confirmation bidon refusé", s == 400)

# ---------------------------------------------------------------- H5. pages profils pour Google (via le site)
print("== H5. SEO")
W = sys.argv[3] if len(sys.argv) > 3 else "http://localhost:4000"
def page(path):
    with urllib.request.urlopen(W + path, timeout=60) as r:
        return r.status, r.read().decode()
try:
    s, html = page("/p/tresses-by-awa")
    import re as _re
    title = _re.search(r"<title>(.*?)</title>", html)
    check("H5", "titre propre au profil", bool(title) and "Tresses by Awa" in title.group(1), title and title.group(1))
    check("H5", "balises Open Graph (aperçu de lien) avec image", 'property="og:title"' in html and 'property="og:image"' in html)
    check("H5", "nom et services présents dans le HTML", "Knotless braids" in html)
    check("H5", "données structurées LocalBusiness", '"@type":"LocalBusiness"' in html)
    s, xml = page("/sitemap.xml")
    check("H5", "sitemap.xml liste les profils publiés", s == 200 and "/p/tresses-by-awa" in xml and "/p/nappy-queen-studio" not in xml)
    s, txt = page("/robots.txt")
    check("H5", "robots.txt (privé exclu, sitemap indiqué)", s == 200 and "Disallow: /admin" in txt and "Sitemap:" in txt)
except Exception as e:
    check("H5", "pages du site accessibles", False, str(e))

# ---------------------------------------------------------------- H. emails
print("== H. Emails")
time.sleep(3)
s, b, _ = req("GET", "/admin/emails", token=ADMIN)
subjects = [e["subject"] for e in b["items"]]
for label, frag in [("bienvenue", "Bienvenue"), ("profil à valider", "À valider"), ("nouvelle demande", "Nouvelle demande"), ("demande acceptée", "accepté votre demande"), ("profil refusé", "corrections"), ("profil en ligne", "en ligne")]:
    check("emails", f"email « {label} » enregistré et envoyé", any(frag in x for x in subjects))
check("emails", "aucun email en échec ou bloqué", b["counts"].get("FAILED", 0) == 0 and b["counts"].get("PENDING", 0) == 0)

ok = sum(r["ok"] for r in RESULTS)
print(f"\nRÉSULTAT : {ok}/{len(RESULTS)} vérifications réussies")
json.dump(RESULTS, open(sys.argv[2] if len(sys.argv) > 2 else "/dev/null", "w"), ensure_ascii=False, indent=1)
