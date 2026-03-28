---
title: "Local Event Discovery Engine"
slug: "local-event-discovery-engine"
updated_at: "2026-03-28T20:00:00Z"
latest_revision: "2026-03-28T20-00-00Z"
---

{{infobox|title=Local Event Discovery Engine|type=Project idea|author=Kreijstal|date=March 2026|website=}}

A proposed system for exhaustively discovering places, events, and community activities in a geographic area (starting with Berlin-Charlottenburg), with a focus on things a single person can attend alone.

## Motivation

Finding local recurring activities — table tennis clubs, hackerspaces, pub quizzes, board game nights, open workshops — is surprisingly hard. Information is scattered across club websites, Meetup, Eventbrite, Facebook Events, Reddit, and word of mouth. Most discovery tools optimize for polished commercial events, not small community activities.

The specific problems:

- **Category blindness**: searching by fixed categories misses things you didn't know to search for
- **Freshness**: many listed venues are stale, closed, or have dead websites
- **Solo-viability**: hard to tell if you can show up alone or need to bring people
- **Sunday problem**: in Germany, Sundays are particularly dead — knowing what's actually open and joinable matters
- **Fragmentation**: the same event may appear on a venue website, Meetup, and Reddit, but never in one place

## Architecture: Three Discovery Layers

The system is designed as three complementary pipelines that feed into a unified review system.

### Layer 1: Place Discovery

Find stable entities in a geographic radius using OpenStreetMap/Overpass:

- Clubs (Sportvereine, Kulturvereine)
- Bars and cafés with regular events
- Community centers
- Studios and workshops
- Libraries and public institutions
- Hackerspaces and makerspaces

**Key insight**: start from everything with a URL in the area, then filter — don't start from fixed categories.

For each place, enrich with:

- Official website status
- Schedule/calendar detection
- Outbound links to Meetup, Eventbrite, Facebook, Instagram
- Freshness signals (latest dated content, future events, working booking flow)

### Layer 2: Event Discovery

Extract structured events from official and semi-official sources:

- Venue websites (calendar pages, Termine, Kursplan)
- Meetup groups
- Eventbrite listings
- Booking platforms (Eversports, etc.)

Events are linked back to places when possible.

### Layer 3: Community Signal Ingestion

The most ambitious layer. Detect informal event mentions from unstructured text:

- Reddit posts and comments (local subreddits)
- Forums
- Community discussion spaces

A Reddit comment like *"there's a board game night Thursday at 7 in Charlottenburg"* becomes a candidate signal with extracted fields and a confidence score.

**These are weak signals, not ground truth.** They may:

- Discover hidden opportunities
- Confirm that a stale-looking venue is still active
- Surface leads for human verification

## Review-First Design

The system is an **evidence engine**, not just a scraper. Humans spend most of their time reviewing, so the software optimizes for review throughput.

Every candidate (place, event, or signal) stores:

- Raw input and source
- Extracted features
- AI classification with confidence and rationale
- Accept/reject decision with reason codes
- Human corrections

### Reason Codes

Structured reasons for every decision:

**Acceptance**: `official_future_event`, `recurring_schedule_found`, `solo_viable_language_found`, `multiple_sources_agree`

**Rejection**: `outside_geo_boundary`, `stale_source`, `no_actionable_time`, `not_single_person_viable`, `duplicate_candidate`

**Uncertain**: `ambiguous_venue`, `weak_informal_signal`, `schedule_unclear`

### Confidence Model

- **Verified**: confirmed from official site with future dates
- **Likely**: strong signals but not fully confirmed
- **Possible**: plausible but evidence is thin
- **Weak lead**: worth checking but low confidence
- **Discard**: clearly irrelevant or dead

## Solo-Viability Filter

A key differentiator. For each activity, determine if a single person can participate without bringing others:

**Solo-friendly signals**: "Probetraining", "Gäste willkommen", "offene Gruppe", "drop-in", "Anfänger willkommen", "Schnupperstunde"

**Not solo-friendly signals**: "Anmeldung paarweise", "nur für Mitglieder", "court booking required"

**Access difficulty scoring**:

- **A** — show up alone (public session, open training, quiz night)
- **B** — likely okay alone but contact first (Probetraining with unclear flow)
- **C** — probably not (partner sport, private members-only)
- **D** — unclear

## Freshness Scoring

Not binary "up to date or not" but a recency score based on signals:

- Website reachable
- Latest event date
- Future events exist
- Recent social media posts
- Booking widget still active
- No "pandemic closure" signals

Classification: **Fresh** (updates in last 90 days) → **Probably active** → **Stale** → **Dead**

## LLM Integration

AI is used for semantic judgment, not raw scraping:

- Classifying venue types from messy website text
- Deciding solo-viability from German-language descriptions
- Detecting whether text describes a real event or casual mention
- Categorizing informal signals
- Summarizing evidence for human review

**Design principle**: code for collection, LLMs for meaning.

Two-stage model use:
1. Cheap classifier for obvious accept/reject
2. Stronger model only for ambiguous cases

## Estimated Costs (Charlottenburg only)

- **Lean**: ~€15–60/month (selective LLM, no browser automation)
- **Comfortable**: ~€50–150/month (regular crawling, more AI classification)
- **Ambitious**: ~€150–400+/month (frequent refreshes, broad platform coverage)

Scaling to all of Berlin roughly 2–4x these figures.

Main cost drivers: LLM API usage, optional headless browser service for JS-heavy sites.

## Existing Tools and Dependencies

| Layer | Existing tools |
|-------|---------------|
| Place discovery | OpenStreetMap, Overpass API |
| Web crawling | httpx, BeautifulSoup, readability |
| Event extraction | OmniEvent, Meetup/Eventbrite scrapers |
| Social event detection | SocialED |
| Review UI | Argilla, Label Studio, Prodigy |
| Data quality | Cleanlab, Snorkel |

## Charlottenburg Findings (Initial Research)

Places confirmed as solo-friendly with some schedule visibility:

| Place | Type | Solo? | Calendar? |
|-------|------|-------|-----------|
| SCC Tischtennis | Sportverein | Yes (Freizeitgruppe Tue 17–21:45) | Yes (public calendar + iCal) |
| CTTC 70 | Tischtennisverein | Yes (Probetraining, Fri hobby play) | Weak (times/news only) |
| TSV58 Tischtennis | Sportverein | Somewhat (Probetraining) | Mixed (members-only planner) |
| Pro Sport Berlin 24 | Fitness studio | Yes (classes, free trial) | Yes (Kursplan) |
| ART Stalker | Bar + events | Yes (public events, quiz nights) | Yes-ish (event-focused) |

Hackerspaces with good public calendars (c-base, xHain) exist in Berlin but not in Charlottenburg.

## Sunday Problem

In Germany, shops close on Sundays by law. For people who don't fit the "approved Sunday activities" (museums, sports, brunch), the city can feel dead.

Budget-friendly Sunday escapes in Berlin:
- Board game cafés (Tales Untold, Brettspielplatz)
- Cinema (Zoo Palast, Yorck Kinos)
- Hotel lobbies and lounges open to non-guests (The Hoxton Wintergarden, Waldorf Astoria Library)
- Station supermarkets (Rewe Hauptbahnhof, Edeka Südkreuz)
- Day spas (vabali, hotel wellness day tickets)

## See Also

- [User:kreijstal](/wiki/User:kreijstal/) — project author
