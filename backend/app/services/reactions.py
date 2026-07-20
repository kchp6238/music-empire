"""Fan comment generation.

Comments used to be 15 canned strings picked at random on the client, during
render — so every persona said the same things, and the words changed every
time React repainted. They're written here instead, from the signal scoring.py
already computes but never used: which specific tag the listener liked or
disliked, how strongly, whether the song was a fluke hit, whether this listener
already follows the artist.

Two properties matter:

- **Deterministic.** Seeded on (song, persona), so a song's reactions read the
  same on the results screen, in the feed, and tomorrow. A comment that
  reshuffles is obviously fake.
- **Grounded.** Every line names something true about the song. "발라드라 좋다"
  only appears when the song is actually a 발라드 and this persona actually
  likes 발라드.
"""

import random

from app.services.game_data import FAN_PERSONAS_SEED

# voice is persona identity, not DB state — see game_data.FAN_PERSONAS_SEED.
VOICE_BY_NAME = {p["name"]: p.get("voice", "casual") for p in FAN_PERSONAS_SEED}
DEFAULT_VOICE = "casual"

# Korean particles agree with whether the previous syllable ends in a consonant.
# Tags include Latin ones (EDM, R&B), which agree by how they're *read* — EDM is
# 이디엠 (consonant-final, so 은/이), R&B is 알앤비 (vowel-final, so 는/가).
_LATIN_FINAL_CONSONANT = set("lmnrLMNR")  # 엘/엠/엔/알 — the letters read with a 받침


def _ends_with_consonant(word: str) -> bool:
    if not word:
        return False
    ch = word[-1]
    if "가" <= ch <= "힣":          # Hangul syllable block
        return (ord(ch) - 0xAC00) % 28 != 0  # final-consonant index
    if ch.isalpha():
        return ch in _LATIN_FINAL_CONSONANT
    if ch.isdigit():
        return ch in "0136780"               # 영/일/삼/육/칠/팔/십 read with a 받침
    return False


def _particle(word: str, after_consonant: str, after_vowel: str) -> str:
    return after_consonant if _ends_with_consonant(word) else after_vowel


def _tag_particles(tag: str) -> dict:
    """Slot values so templates can write {tag}{eun} instead of hardcoding."""
    return {
        "tag": tag,
        "eun": _particle(tag, "은", "는"),
        "i": _particle(tag, "이", "가"),
        "ira": _particle(tag, "이라", "라"),
    }

# Closing clauses per register — the verdict. Appended to the built-up clause
# with a space, never a period: both the opener and the detail end in Korean
# connective endings (-는데 / -고), which want the sentence to continue.
VOICE_STYLE = {
    "soft": {
        "love": ["계속 듣게 되네요.", "오래 남을 것 같아요.", "며칠은 이것만 들을 것 같아요."],
        "good": ["플레이리스트에 담아뒀어요.", "종종 꺼내 들을 것 같아요.", "마음에 들어요."],
        "meh": ["나쁘진 않네요.", "딱 한 번 정도 들을 것 같아요.", "무난하게 들었어요."],
        "bad": ["저랑은 잘 안 맞네요.", "조금 아쉬워요.", "끝까지 듣진 못했어요."],
        "awful": ["미안하지만 스킵했어요.", "다음 곡을 기다릴게요.", "제 취향은 아니에요."],
    },
    "hype": {
        "love": ["미쳤다!!", "이거 클럽에서 틀어야 해", "개좋아 진짜"],
        "good": ["오 괜찮은데?", "이거 물건이네", "잘 뽑았다"],
        "meh": ["음… 그냥저냥?", "약간 심심해", "한 번은 듣겠다"],
        "bad": ["이건 좀 아니지", "텐션이 안 올라와", "노잼…"],
        "awful": ["바로 넘겼다", "이건 진짜 아니야", "하…"],
    },
    "blunt": {
        "love": ["인정.", "이건 진짜다.", "계속 돌린다."],
        "good": ["들을 만하다.", "나쁘지 않네.", "합격."],
        "meh": ["그냥 그렇다.", "한 번 듣고 끝.", "애매하네."],
        "bad": ["별로다.", "내 취향 아님.", "패스."],
        "awful": ["이건 아니다.", "스킵.", "왜 이렇게 냈지."],
    },
    "critic": {
        "love": ["올해 손에 꼽을 트랙이다.", "완성도와 야심이 함께 간다.", "계속 지켜볼 만하다."],
        "good": ["흥미로운 시도다.", "다듬으면 더 멀리 가겠다.", "방향은 분명하다."],
        "meh": ["기억에 남진 않는다.", "인상이 흐리다.", "결정적인 한 방이 없다."],
        "bad": ["설득되지 않는다.", "의도가 결과를 못 따라갔다.", "아쉬운 마감이다."],
        "awful": ["실패한 실험이다.", "다시 들을 이유를 못 찾겠다.", "재고가 필요하다."],
    },
    "elder": {
        "love": ["이런 게 노래지.", "아주 좋구먼.", "오랜만에 제대로 들었네."],
        "good": ["들을 만허이.", "괜찮구먼.", "나쁘지 않아."],
        "meh": ["그저 그렇구먼.", "뭐, 한 번은 들었네.", "무던허이."],
        "bad": ["요샌 다 이런가.", "내 귀엔 안 맞네.", "글쎄올시다."],
        "awful": ["이건 못 듣겠구먼.", "시끄럽기만 허이.", "옛날 노래가 낫지."],
    },
    "casual": {
        "love": ["완전 취향저격", "요즘 이것만 들어", "친구들한테 공유했어"],
        "good": ["괜찮네", "저장했어", "또 들을 듯"],
        "meh": ["그냥 무난해", "한 번 듣고 말 듯", "나쁘진 않아"],
        "bad": ["내 스타일은 아니야", "흠…", "별로였어"],
        "awful": ["스킵했어", "이건 좀…", "다음 곡 기대할게"],
    },
}

# The opening clause: what the listener noticed first. Templates take particle
# slots ({eun}/{i}/{ira}) so tags agree grammatically — "EDM은" but "발라드는".
LIKED_TAG = [
    "{tag} 딱 내 취향이라",
    "{tag} 좋아하는데 이건 제대로 뽑았고",
    "{tag} 이렇게 뽑아주면 반칙이지 싶고",
    "{tag} 쪽으로 이만하면 훌륭하고",
]
DISLIKED_TAG = [
    "{tag}{eun} 원래 안 듣는데",
    "{tag}{i} 좀 부담스럽더라고",
    "{tag} 취향이 아니라 그런지",
    "하필 {tag}{ira}",
]
NEUTRAL_OPEN = [
    "처음 듣는 스타일인데",
    "우연히 흘러나와서 들었는데",
    "추천에 떠서 들어봤는데",
    "한 번 들어봤는데",
]
HIGH_CRAFT = ["마감이 깔끔하고", "소리가 잘 정리돼 있고", "믹스가 단단하고"]
LOW_CRAFT = ["마감이 좀 거칠고", "소리가 정리가 덜 됐고", "밸런스가 아쉽고"]
HIGH_ORIGINALITY = ["구성이 신선하고", "안 가본 길로 가고", "전개가 예상 밖이고"]
LOW_ORIGINALITY = ["어디서 들어본 듯하고", "익숙한 공식이고", "안전하게 갔고"]
GENIUS = ["중간에 소름 돋는 구간이 있고", "한 방이 확실하고", "훅이 머리에 박히고"]
SLEEPER = ["뒤늦게 발견했는데", "묻히기 아까운데", "이제야 알았는데"]
LOYAL = ["전에 낸 것도 좋았는데", "이 아티스트 계속 듣고 있는데", "믿고 듣는 편인데"]

BANDS = [(80, "love"), (60, "good"), (40, "meh"), (20, "bad"), (0, "awful")]

# Mood tags are stored as bare nouns/adjective stems, which read wrong dropped
# straight into a sentence ("감성적 딱 내 취향이라"). Genres need no such help.
MOOD_PHRASE = {
    "감성적": "감성적인 곡", "신남": "신나는 곡", "우울": "우울한 곡", "강렬": "강렬한 곡",
    "로맨틱": "로맨틱한 곡", "몽환적": "몽환적인 곡", "편안함": "편안한 곡", "실험적": "실험적인 곡",
}


def band_for(score: float) -> str:
    for threshold, name in BANDS:
        if score >= threshold:
            return name
    return "awful"


def _tag_opinion(persona: dict, genre_tags, mood_tags):
    """The single tag this listener felt most strongly about, and the sign of
    that feeling. This is what keeps a line honest: it can only mention a tag
    the song actually carries."""
    best = None  # (abs weight, phrase, weight)
    for tags, pref_key, is_mood in (
        (genre_tags or [], "genre_pref", False),
        (mood_tags or [], "mood_pref", True),
    ):
        prefs = persona.get(pref_key) or {}
        for tag in tags:
            w = prefs.get(tag)
            if w is None or w == 0:
                continue
            if best is None or abs(w) > best[0]:
                phrase = MOOD_PHRASE.get(tag, tag) if is_mood else tag
                best = (abs(w), phrase, w)
    if best is None:
        return None, 0.0
    return best[1], best[2]


def build_comment(persona: dict, reaction: dict, song_input: dict, result: dict, loyalty: float, seed: str) -> str:
    """One fan's take on one song. `seed` fixes the wording forever."""
    rng = random.Random(seed)

    score = float(reaction["reaction_score"])
    band = band_for(score)
    voice = VOICE_BY_NAME.get(persona.get("name", ""), DEFAULT_VOICE)
    style = VOICE_STYLE.get(voice, VOICE_STYLE[DEFAULT_VOICE])

    tag, weight = _tag_opinion(persona, song_input.get("genre_tags"), song_input.get("mood_tags"))

    # Opening: lead with the tag they felt strongest about, when there is one.
    if tag and weight >= 0.3:
        opener = rng.choice(LIKED_TAG).format(**_tag_particles(tag))
    elif tag and weight <= -0.3:
        opener = rng.choice(DISLIKED_TAG).format(**_tag_particles(tag))
    elif loyalty > 0 and rng.random() < 0.6:
        opener = rng.choice(LOYAL)
    else:
        opener = rng.choice(NEUTRAL_OPEN)

    # A second clause about the song itself — only when there's something
    # notable to say, so lines don't all become the same length.
    attrs = result.get("attributes") or {}
    craft = float(attrs.get("craft", 50))
    originality = float(attrs.get("originality", 50))

    details = []
    if result.get("genius_event"):
        details.append(rng.choice(GENIUS))
    if result.get("sleeper_hit"):
        details.append(rng.choice(SLEEPER))
    if craft >= 70:
        details.append(rng.choice(HIGH_CRAFT))
    elif craft <= 35:
        details.append(rng.choice(LOW_CRAFT))
    if originality >= 70:
        details.append(rng.choice(HIGH_ORIGINALITY))
    elif originality <= 30:
        details.append(rng.choice(LOW_ORIGINALITY))

    clause = opener
    if details:
        clause = f"{opener} {rng.choice(details)}"

    line = f"{clause} {rng.choice(style[band])}"
    # comment_line is String(255); Korean text is nowhere near that, but a
    # truncated sentence beats a failed insert.
    return line[:255]


def build_for_reactions(persona_by_id: dict, persona_results: list, song_input: dict, result: dict,
                        loyalty_by_persona: dict, song_id: str) -> dict:
    """persona_id -> comment, for every persona that actually heard the song.

    Unreached listeners get no line: the UI already says they haven't found it.
    """
    out = {}
    for r in persona_results:
        if not r["reached"]:
            continue
        pid = r["persona"]["id"]
        persona = persona_by_id.get(pid, r["persona"])
        out[pid] = build_comment(
            persona, r, song_input, result,
            loyalty=float(loyalty_by_persona.get(pid, 0)),
            seed=f"{song_id}:{pid}",
        )
    return out


def build_npc_comments(npc_song, personas: list, count: int = 2) -> list[dict]:
    """Lines for an NPC song, which has no stored reactions.

    Generated on the fly rather than persisted — NPC songs exist to populate a
    chart, and writing reaction rows for every one of them would be a lot of
    storage for decoration. Seeded on the song id so they're stable anyway.
    """
    rng = random.Random(f"npc:{npc_song.id}")
    score = float(npc_song.score)
    genre = getattr(npc_song.artist, "genre", None)
    song_input = {"genre_tags": [genre] if genre else [], "mood_tags": []}
    # NPC songs carry a score but none of the attribute breakdown a real
    # release has; approximating from the score keeps the phrasing plausible.
    result = {"attributes": {"craft": score, "originality": score * 0.8}, "genius_event": False, "sleeper_hit": False}

    chosen = rng.sample(personas, min(count, len(personas)))
    out = []
    for p in chosen:
        persona = {
            "id": p.id, "name": p.name, "color": p.color,
            "genre_pref": p.genre_pref, "mood_pref": p.mood_pref,
        }
        reaction = {"reaction_score": score}
        out.append({
            "persona_name": p.name,
            "persona_color": p.color,
            "comment_line": build_comment(persona, reaction, song_input, result, 0.0, f"npc:{npc_song.id}:{p.id}"),
        })
    return out
