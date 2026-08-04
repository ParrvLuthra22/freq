"""Author the v2 seed from the prototype.

The prototype ships hardcoded FREQ scores. We keep the live §5 algorithm instead,
which needs something the prototype does not carry: a full ranked top-artist list
per person. Those are authored here so rarity and overlap have real inputs, with
the shared-artist sets chosen to preserve the prototype's intended ordering
(Odessa strongest, Vesper weakest).

Everything the prototype does provide — copy, hours, game content — is carried
across verbatim.
"""

import json
from collections import Counter
from pathlib import Path

# Resolved from this file so the script runs from anywhere in the repo.
OUT = Path(__file__).resolve().parent.parent / "seed" / "users.json"

# Global popularity, low = obscure. The eight from MY_ARTISTS keep the
# prototype's own ranks; the rest fill out the corpus so rarity has a population.
RANK = {
    "Grouper": 8, "Duster": 14, "Alex G": 22, "Adrianne Lenker": 27,
    "Yves Tumor": 31, "Cocteau Twins": 44, "Burial": 52, "Fiona Apple": 61,
    "Dean Blunt": 35, "Arca": 38, "Tirzah": 42, "Beach House": 46,
    "Slowdive": 48, "My Bloody Valentine": 55, "Sufjan Stevens": 57,
    "Weyes Blood": 59, "Mazzy Star": 64, "Japanese Breakfast": 66,
    "Big Thief": 58,
}

TAGS = {
    "Grouper": ["ambient", "drone", "slowcore"],
    "Duster": ["slowcore", "lo-fi", "shoegaze"],
    "Alex G": ["indie rock", "lo-fi", "folk"],
    "Adrianne Lenker": ["indie folk", "folk"],
    "Yves Tumor": ["art rock", "experimental"],
    "Cocteau Twins": ["dream pop", "shoegaze"],
    "Burial": ["ambient", "electronic"],
    "Fiona Apple": ["art rock", "singer-songwriter"],
    "Dean Blunt": ["experimental", "art rock"],
    "Arca": ["experimental", "electronic"],
    "Tirzah": ["electronic", "soul"],
    "Beach House": ["dream pop", "shoegaze"],
    "Slowdive": ["shoegaze", "dream pop"],
    "My Bloody Valentine": ["shoegaze", "noise"],
    "Sufjan Stevens": ["indie folk", "folk"],
    "Weyes Blood": ["indie folk", "dream pop"],
    "Mazzy Star": ["dream pop", "folk"],
    "Japanese Breakfast": ["indie pop", "dream pop"],
    "Big Thief": ["indie folk", "folk"],
}

HOURS = {
    "me":      [62,88,100,92,70,40,18,10,8,9,12,16,20,24,28,34,42,50,58,64,70,76,84,92],
    "odessa":  [70,95,100,96,78,44,16,8,6,7,10,14,18,22,26,30,38,46,54,60,68,74,82,90],
    "rune":    [58,84,96,90,66,34,14,10,12,16,20,26,32,38,42,46,50,56,60,66,72,78,84,90],
    "marlowe": [55,80,92,86,60,30,14,12,14,18,24,30,36,40,44,48,52,58,62,66,70,74,78,84],
    "thea":    [40,60,76,70,48,26,16,18,24,30,38,44,50,56,60,66,70,74,78,72,64,56,48,44],
    "juno":    [30,42,50,44,26,14,10,14,26,40,52,60,68,74,80,86,92,100,96,80,64,50,40,34],
    "vesper":  [12,8,6,6,10,30,58,80,94,100,88,70,58,52,48,50,54,58,60,56,48,36,24,16],
}

TRACKS = {
    "Grouper": ["Heavy Water / I’d Rather Be Sleeping", "Cover the Windows and the Walls"],
    "Duster": ["Inside Out", "Constellations"],
    "Alex G": ["Sandy", "Gretel"],
    "Adrianne Lenker": ["Anything", "Half Return"],
    "Yves Tumor": ["Kerosene!", "Gospel for a New Century"],
    "Cocteau Twins": ["Cherry-coloured Funk", "Heaven or Las Vegas"],
    "Burial": ["Archangel", "Untrue"],
    "Fiona Apple": ["I Want You to Love Me", "Shameika"],
    "Slowdive": ["Alison", "When the Sun Hits"],
    "Big Thief": ["Not", "Paul"],
    "Mazzy Star": ["Fade Into You", "Into Dust"],
    "My Bloody Valentine": ["Only Shallow", "Sometimes"],
    "Beach House": ["Space Song", "Myth"],
    "Dean Blunt": ["The Pedigree", "Look What You’ve Done"],
    "Arca": ["Nonbinary", "Time"],
    "Tirzah": ["Devotion", "Gladly"],
    "Sufjan Stevens": ["Death with Dignity", "Fourth of July"],
    "Weyes Blood": ["Andromeda", "Movies"],
    "Japanese Breakfast": ["Be Sweet", "Paprika"],
}

# Artist lists authored so shared-set rarity preserves the prototype's ordering.
ARTISTS = {
    "me": ["Grouper", "Duster", "Alex G", "Adrianne Lenker", "Yves Tumor",
           "Cocteau Twins", "Burial", "Fiona Apple"],
    "odessa": ["Grouper", "Duster", "Alex G", "Slowdive", "Cocteau Twins",
               "Mazzy Star", "Adrianne Lenker", "Burial"],
    "rune": ["Duster", "Alex G", "Big Thief", "Slowdive", "Burial",
             "My Bloody Valentine", "Mazzy Star", "Beach House"],
    "marlowe": ["Adrianne Lenker", "Big Thief", "Mazzy Star", "Alex G",
                "Fiona Apple", "Slowdive", "Cocteau Twins", "My Bloody Valentine"],
    "thea": ["Slowdive", "Cocteau Twins", "My Bloody Valentine", "Beach House",
             "Mazzy Star", "Japanese Breakfast", "Big Thief", "Alex G"],
    "juno": ["Yves Tumor", "Arca", "Dean Blunt", "Fiona Apple", "Alex G",
             "Tirzah", "Japanese Breakfast", "Weyes Blood"],
    "vesper": ["Cocteau Twins", "Slowdive", "Beach House", "Weyes Blood",
               "Sufjan Stevens", "Mazzy Star", "Japanese Breakfast", "Big Thief"],
}

ENERGY = {
    "me":      {"night": 88, "emotional": 79, "highEnergy": 41, "exploratory": 72},
    "odessa":  {"night": 92, "emotional": 84, "highEnergy": 34, "exploratory": 68},
    "rune":    {"night": 86, "emotional": 71, "highEnergy": 44, "exploratory": 62},
    "marlowe": {"night": 81, "emotional": 88, "highEnergy": 30, "exploratory": 55},
    "thea":    {"night": 64, "emotional": 76, "highEnergy": 52, "exploratory": 58},
    "juno":    {"night": 38, "emotional": 62, "highEnergy": 91, "exploratory": 84},
    "vesper":  {"night": 18, "emotional": 66, "highEnergy": 47, "exploratory": 49},
}

PEOPLE = [
    dict(id="odessa", name="Odessa", age=23, likedYou=True, archetype="The 3AM Archivist",
         archetypeDesc="Keeps the hours nobody asks her to keep, and a library to match.",
         week=dict(artist="Grouper", plays=41, stat="41 PLAYS · UP 3 THIS WEEK"),
         reason="3 RARE SHARED ARTISTS", reasonSoft="Same artist of the week as you.",
         chips=[["Grouper", True], ["Duster", True], ["Alex G", True], ["slowcore", False]],
         line="You both keep Grouper in your top ten, which almost nobody here does. Then you both stay up to play it.",
         flirt="She was awake at two, playing your record.",
         song=dict(title="Heavy Water / I’d Rather Be Sleeping", artist="Grouper"),
         hoursNote="BOTH PEAK AT 2AM", rarityNote="3 DEEP CUTS SHARED",
         quizOptions=["Duster", "Grouper", "Alex G", "Slowdive"], quizAnswer="Grouper",
         swapTrack="Cover the Windows and the Walls — Grouper",
         swapVerdict="You both reached for the same record. Neither of you is normal.",
         takeAnswer=78,
         thread=[dict(sender="them", text="ok the Grouper thing is unfair. nobody has that in their top five.")]),

    dict(id="rune", name="Rune", age=24, likedYou=True, archetype="The Long Drive",
         archetypeDesc="Puts one record on and lets the whole night run out behind it.",
         week=dict(artist="Duster", plays=36, stat="36 PLAYS · 4 WEEKS RUNNING"),
         reason="SHARED: DUSTER, ALEX G", reasonSoft="Four weeks on the same record.",
         chips=[["Duster", True], ["Alex G", True], ["slowcore", False]],
         line="Four weeks on Duster is not a phase, it is a personality. Yours too, apparently.",
         flirt="Four weeks on the same record. Somebody had to notice.",
         song=dict(title="Inside Out", artist="Duster"),
         hoursNote="OVERLAP 12AM–3AM", rarityNote="2 DEEP CUTS SHARED",
         quizOptions=["Duster", "Burial", "Fiona Apple", "Grouper"], quizAnswer="Duster",
         swapTrack="Constellations — Duster",
         swapVerdict="Same band, different side of the record. That will do.",
         takeAnswer=41,
         thread=[dict(sender="them", text="you have Duster at 14. i have them at 2. we should talk about this.")]),

    dict(id="marlowe", name="Marlowe", age=24, likedYou=False, archetype="The Patient Romantic",
         archetypeDesc="Quiet records, late hours, and no hurry about any of it.",
         week=dict(artist="Adrianne Lenker", plays=29, stat="29 PLAYS · NEW THIS WEEK"),
         reason="SAME 2AM WINDOW", reasonSoft="Awake at the same hours as you.",
         chips=[["Adrianne Lenker", True], ["Big Thief", False], ["folk", False]],
         line="Different records, same hour. You are both awake at two, playing something quiet.",
         flirt="Different records. Identical hours.",
         song=dict(title="Anything", artist="Adrianne Lenker"),
         hoursNote="CURVES ALMOST IDENTICAL", rarityNote="1 DEEP CUT SHARED",
         quizOptions=["Big Thief", "Adrianne Lenker", "Alex G", "Mazzy Star"], quizAnswer="Adrianne Lenker",
         swapTrack="Not — Big Thief",
         swapVerdict="One quiet, one loud. That is a whole evening.",
         takeAnswer=88,
         thread=[dict(sender="them", text="we have the same 2am. that is either fate or insomnia.")]),

    dict(id="thea", name="Thea", age=22, likedYou=True, archetype="The Shoegazer",
         archetypeDesc="Everything through a wall of reverb, and better for it.",
         week=dict(artist="Slowdive", plays=33, stat="33 PLAYS · UP 11"),
         reason="DREAM POP, BOTH OF YOU", reasonSoft="Lives in the room next to yours.",
         chips=[["Slowdive", False], ["Cocteau Twins", False], ["shoegaze", False]],
         line="Your Cocteau Twins sits right next to her Slowdive. Nobody has to compromise.",
         flirt="She has been standing in the next room this whole time.",
         song=dict(title="Cherry-coloured Funk", artist="Cocteau Twins"),
         hoursNote="SHE FADES OUT BY 1AM", rarityNote="ONE SHARED WORLD",
         quizOptions=["Cocteau Twins", "Slowdive", "My Bloody Valentine", "Grouper"], quizAnswer="Slowdive",
         swapTrack="Alison — Slowdive",
         swapVerdict="Two versions of the same feeling.",
         takeAnswer=62,
         thread=[dict(sender="them", text="cocteau twins at 44? criminal. promote them.")]),

    dict(id="juno", name="Juno", age=21, likedYou=False, archetype="The Maximalist",
         archetypeDesc="Loud, restless, and entirely unembarrassed about any of it.",
         week=dict(artist="Yves Tumor", plays=52, stat="52 PLAYS · LOUDEST WEEK HERE"),
         reason="SHARED: YVES TUMOR", reasonSoft="Your loud record, all week long.",
         chips=[["Yves Tumor", True], ["Fiona Apple", False], ["art rock", False]],
         line="Your one loud record is her entire personality. That could go somewhere.",
         flirt="Your loudest record is her whole personality.",
         song=dict(title="Kerosene!", artist="Yves Tumor"),
         hoursNote="SHE PEAKS AT 5PM", rarityNote="1 DEEP CUT SHARED",
         quizOptions=["Fiona Apple", "Dean Blunt", "Yves Tumor", "Alex G"], quizAnswer="Yves Tumor",
         swapTrack="Gospel for a New Century — Yves Tumor",
         swapVerdict="You sent quiet. She sent a riot. Balanced.",
         takeAnswer=22,
         thread=[dict(sender="them", text="daylight listener. i know. i am working on it.")]),

    dict(id="vesper", name="Vesper", age=22, likedYou=False, archetype="The Early Riser",
         archetypeDesc="Does her best listening while the rest of you are still asleep.",
         week=dict(artist="Cocteau Twins", plays=24, stat="24 PLAYS · MOSTLY BEFORE 9AM"),
         reason="TASTE WORLDS TOUCH", reasonSoft="Same records, opposite hours.",
         chips=[["Cocteau Twins", False], ["Slowdive", False], ["ambient", False]],
         line="You barely overlap — except in dream pop, and she gets up at six. Somebody would have to bend.",
         flirt="She is asleep by the time you start.",
         song=None,
         hoursNote="YOUR HOURS ARE INVERTED", rarityNote="NO DEEP CUTS SHARED",
         quizOptions=["Slowdive", "Mazzy Star", "Cocteau Twins", "Duster"], quizAnswer="Cocteau Twins",
         swapTrack="Fade Into You — Mazzy Star",
         swapVerdict="Yours is for 2am. Hers is for 7. Same song, really.",
         takeAnswer=55,
         thread=[dict(sender="them", text="i am asleep by eleven. this will never work. send the record anyway.")]),
]


def artists_for(key):
    return [{"name": n, "rank": RANK[n]} for n in ARTISTS[key]]


def tracks_for(key):
    """Two tracks from the top three artists, one from the next — a plausible top-tracks list."""
    out = []
    for i, name in enumerate(ARTISTS[key][:4]):
        picks = TRACKS[name][: (2 if i < 3 else 1)]
        out += [{"title": t, "artist": name} for t in picks]
    return out


def tags_for(key, limit=6):
    counter = Counter()
    names = ARTISTS[key]
    for i, name in enumerate(names):
        weight = max(1, len(names) - i)
        for tag in TAGS[name]:
            counter[tag] += weight
    derived = [t for t, _ in counter.most_common(limit - 1)]
    energy = ENERGY[key]
    mood = max(energy.items(), key=lambda kv: kv[1])[0]
    mood_tag = {"night": "late-night", "emotional": "melancholic",
                "highEnergy": "euphoric", "exploratory": "restless"}[mood]
    if mood_tag not in derived:
        derived.append(mood_tag)
    return derived


me = {
    "id": "me", "name": "Alex", "age": 23, "campus": "NYU",
    "archetype": {
        "name": "The Midnight Romantic",
        "description": "You save your best listening for the hours nobody is watching — slowcore, ambient, and one loud record you refuse to explain.",
    },
    "week": {"artist": "Grouper", "plays": 47, "stat": "47 PLAYS · YOUR HIGHEST YET"},
    "topArtists": artists_for("me"),
    "topTracks": tracks_for("me"),
    "listeningHours": HOURS["me"],
    "tags": tags_for("me"),
    "energy": ENERGY["me"],
    "currentFrequency": "Rotating slower, sadder Grouper deep cuts on repeat since Tuesday.",
    "swapPicks": [
        "Heavy Water / I’d Rather Be Sleeping — Grouper",
        "Inside Out — Duster",
        "Sandy — Alex G",
    ],
}

users = []
for p in PEOPLE:
    k = p["id"]
    users.append({
        "id": k, "name": p["name"], "age": p["age"], "campus": "NYU",
        "archetype": {"name": p["archetype"], "description": p["archetypeDesc"]},
        "week": p["week"],
        "likedYou": p["likedYou"],
        "topArtists": artists_for(k),
        "topTracks": tracks_for(k),
        "listeningHours": HOURS[k],
        "tags": tags_for(k),
        "energy": ENERGY[k],
        "reason": p["reason"],
        "reasonSoft": p["reasonSoft"],
        "chips": [{"label": c[0], "rare": c[1]} for c in p["chips"]],
        "line": p["line"],
        "flirt": p["flirt"],
        "song": p["song"],
        "hoursNote": p["hoursNote"],
        "rarityNote": p["rarityNote"],
        "quiz": {"options": p["quizOptions"], "answer": p["quizAnswer"]},
        "swap": {"track": p["swapTrack"], "verdict": p["swapVerdict"]},
        "takeAnswer": p["takeAnswer"],
        "thread": p["thread"],
    })

OUT.write_text(json.dumps({"me": me, "users": users}, ensure_ascii=False, indent=2) + "\n")
print(f"wrote {OUT}  ({len(users)} people, {len(RANK)} artists in corpus)")
for u in users:
    shared = set(ARTISTS[u["id"]]) & set(ARTISTS["me"])
    rare = [s for s in shared if RANK[s] < 35]
    print(f"  {u['name']:8s} shared={len(shared)} rare={len(rare)} tags={u['tags']}")
