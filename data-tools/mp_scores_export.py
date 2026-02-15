import os

import requests
import json
import re
from time import sleep
from dotenv import load_dotenv

load_dotenv()
API_KEY = os.getenv('OSU_API_KEY')
if not API_KEY:
    raise RuntimeError('API_KEY not set')

API_MATCH_URL = "https://osu.ppy.sh/api/get_match"
API_BEATMAP_URL = "https://osu.ppy.sh/api/get_beatmaps"
API_USER_URL = "https://osu.ppy.sh/api/get_user"

MP_LINKS_FILE = "mp_links.txt"
MAPPOOL_FILE = "mappool.json"
OUTPUT_FILE = "data/osu_scores.json"

REQUEST_DELAY = 0.5

def extract_match_id(url: str) -> int | None:
    match = re.search(r"(\d+)$", url)
    return int(match.group(1)) if match else None

def load_mp_links(path: str) -> list[str]:
    with open(path, "r", encoding="utf-8") as f:
        return [line.strip() for line in f if line.strip() and not line.startswith("#")]

def load_mappool(path: str) -> dict:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

def get_match(match_id: int) -> dict:
    response = requests.get(API_MATCH_URL, params={"k": API_KEY, "mp": match_id})
    response.raise_for_status()
    return response.json()

def get_username(user_id: int) -> str:
    r = requests.get(API_USER_URL, params={"k": API_KEY, "u": user_id, "type": "id"})
    r.raise_for_status()
    data = r.json()
    if not data:
        return f"Unknown user {user_id}"
    sleep(REQUEST_DELAY)
    return data[0]["username"]

def get_beatmap(id: int) -> dict:
    r = requests.get(API_BEATMAP_URL, params={"k": API_KEY, "b": id})
    r.raise_for_status()
    data = r.json()
    if not data:
        raise RuntimeError(f"Couldn't find beatmap with id {id}")
    return data[0]

def calc_acc(score: dict) -> float:
    c50 = int(score["count50"])
    c100 = int(score["count100"])
    c300 = int(score["count300"])
    cmiss = int(score["countmiss"])
    total_hits = (c50 + c100 + c300 + cmiss)
    if total_hits == 0:
        return 0.0
    weighted_hits = (
        c50 * 50 + c100 * 100 + c300 * 300
    )
    return round((weighted_hits / (total_hits * 300)) * 100, 2)

def build_db(mp_links: list[str], mappool: dict) -> dict:
    db = {
        "users": {},
        "maps": {},
        "players": {}
    }
    for slot, beatmap_id in mappool.items():
        beatmap_id = int(beatmap_id)
        print(f"Processing beatmap {beatmap_id}")
        map_info = get_beatmap(beatmap_id)
        db["maps"][str(beatmap_id)] = {
            "beatmap_id": beatmap_id,
            "slot": slot,
            "artist": map_info["artist"],
            "title": map_info["title"],
            "difficulty": map_info["version"]
        }
        sleep(REQUEST_DELAY)

    valid_maps = set(db["maps"].keys())

    for link in mp_links:
        match_id = extract_match_id(link)
        if not match_id:
            continue

        print(f"Processing match {match_id}")
        match = get_match(match_id)

        for idx, game in enumerate(match["games"]):
            bid = int(game["beatmap_id"])
            bid_str = str(bid)

            if bid_str not in valid_maps:
                continue

            for score in game["scores"]:
                uid = int(score["user_id"])
                uid_str = str(uid)

                if uid_str not in db["users"]:
                    db["users"][uid_str] = {
                        "user_id": uid,
                        "username": get_username(uid)
                    }

                # add player if we havent ran into him yet
                if uid_str not in db["players"]:
                    db["players"][uid_str] = {
                        "user_id": uid,
                        "username": db["users"][uid_str]["username"],
                        "scores": {}
                    }

                nxt_score = {
                    "match_id": match_id,
                    "game_id": idx,
                    "beatmap_id": bid,
                    "score": int(score["score"]),
                    "accuracy": calc_acc(score),
                    "mods": int(score["enabled_mods"] or 0),
                }

                cur = db["players"][uid_str]["scores"].get(bid_str)

                if not cur or nxt_score["score"] > cur["score"]:
                    db["players"][uid_str]["scores"][bid_str] = nxt_score

                # db["players"][uid_str]["scores"].append({
                #     "match_id": match_id,
                #     "game_id": idx,
                #     "beatmap_id": bid,
                #     "score": int(score["score"]),
                #     "accuracy": calc_acc(score),
                #     "mods": int(score["enabled_mods"] or 0),
                # })

        sleep(REQUEST_DELAY)

    for player in db["players"].values():
        player["scores"] = list(player["scores"].values())

    return db

def main():
    mp_links = load_mp_links(MP_LINKS_FILE)
    mappool = load_mappool(MAPPOOL_FILE)

    db = build_db(mp_links, mappool)

    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(db, f, ensure_ascii=False, indent=4)

    print(f"Wrote to {OUTPUT_FILE}")

if __name__ == "__main__":
    main()