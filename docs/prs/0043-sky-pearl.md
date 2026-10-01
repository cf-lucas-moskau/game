# PR #43: The Sky Pearl

Branch: `claude/goal-test-aotoyo` (commits for PR #43)

## Summary

A mid-map objective that makes teams commit.

- **Timing.** The Pearl is announced 15 s before it surfaces at the centre: first at 3:00, then 3 minutes after it was
  claimed or sank.
- **Capture.** A team claims it by holding its circle (radius 200) with no enemy hero inside for 5 s.
  - A contested circle freezes.
  - An empty circle drains slowly.
  - A lead held by the other team must be wrestled back first.
  - Unclaimed after 75 s, the Pearl sinks.
- **Reward.**
  - Pearl's Blessing for every living hero of the team: +12% attack speed and +15 armor and magic resist for 75 s.
  - 100 gold for each holder.
  - A Pearl Golem in each of the team's next 2 waves: a siege minion with ×2.2 health, ×1.8 damage, gilded and bigger.
- **Camp move.** The camp nests moved to a pair symmetric through the centre. The first layout had crabs 30 units
  from the circle, so they were pulled into every Pearl fight (seen in screenshots).
- **Bots** go to the Pearl when it is about to surface, spread inside the circle by seat, unless the enemy holds it
  with more heroes.
- **Presentation.**
  - An iridescent pearl rises during the announcement; a beam of light marks the spot.
  - The ground ring fills with the holding team's colour.
  - The HUD shows a capture bar in the top bar: a countdown, then the holder and percentage, or "contested".
  - Banners and feed lines announce the Pearl; the minimap shows it with a progress ring.
  - Sounds: a rising chord when announced, a bell when it surfaces, and a fanfare or an ominous chord on capture.

## Measured (all five features, 960 matches)

- 2.2 Pearls claimed per match.
- The team that claims more Pearls wins 80% of matches. This is partly cause and partly correlation, since the
  stronger team also takes the Pearl. Its share is in line with first tower (82%).
