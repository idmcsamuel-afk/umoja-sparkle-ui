# Toggleable 24/7 Circle prompts

## Build
- Make each active Circle card’s “Open 24/7” status a button that starts that tier’s normal minimum-bid action.
- Add a prominent member-home notice linking to the Circle page.
- Add a `platform_settings` boolean flag, enabled by default, that controls whether the home notice appears.
- Add an on/off control in Admin → Platform settings and save it with the existing settings record.

## Technical details
- Keep the existing bid handlers and secure payment paths unchanged; the new card button only calls the existing bid action.
- Read the notice flag from the latest platform settings row on the member home page.
- Preserve all Circle deadlines, expiry, payout, POP/card, and protected-field behavior.

## Verification
- Confirm the card status opens the correct tier’s bid flow.
- Confirm the home notice links to Circles when enabled and disappears when disabled.
- Check the current build and member/admin browser views.
