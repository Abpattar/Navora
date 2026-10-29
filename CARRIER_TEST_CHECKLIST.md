# Carrier website test checklist

## Candidate official tracking pages

- Maersk: <https://www.maersk.com/tracking/>
- MSC: <https://www.msc.com/en/track-a-shipment>
- CMA CGM: <https://www.cma-cgm.com/ebusiness/tracking>
- Hapag-Lloyd: <https://www.hapag-lloyd.com/solutions/tracking/>
- COSCO: <https://elines.coscoshipping.com/ebusiness/cargoTracking>
- Evergreen: <https://www.shipmentlink.com/servlet/TDB1_CargoTracking.do>
- ONE: <https://ecomm.one-line.com/ecom/CUP_HOM_3301.do>
- OOCL: <https://www.oocl.com/eng/ourservices/eservices/cargotracking/Pages/default.aspx>
- ZIM: <https://www.zim.com/tools/track-a-shipment>
- Yang Ming: <https://www.yangming.com/e-service/track_trace/track_trace_cargo_tracking.aspx>

These are candidates. Verify official URLs and accessibility in the browser before the demo. Carrier pages and access policies can change.

## For each carrier, test manually first

- [ ] Official page opens.
- [ ] You have a valid reference that you are authorized to use.
- [ ] Search returns an actual matching shipment.
- [ ] The lookup works without a login, or login requirements are documented.
- [ ] Latest status/event is visible.
- [ ] Location and event date are visible, if supplied.
- [ ] Estimated arrival is visible, if supplied.
- [ ] Milestones are visible, if supplied.
- [ ] The source page can be linked from the app.
- [ ] The result does not rely on circumventing CAPTCHA or another restriction.

## Test TinyFish against the same reference

- [ ] Run the lookup from the application.
- [ ] Compare status, event, location, and ETA with the page.
- [ ] Record which fields are missing rather than filling them with guesses.
- [ ] Confirm source URL and retrieval timestamp appear.
- [ ] Test an invalid reference and ensure the app reports failure honestly.
- [ ] If blocked or login-protected, mark the carrier as unsuitable for the live demo.

## Suggested result fields

Carrier, reference, lookup outcome, latest status, latest event, event location, event date, ETA, origin, destination, last free date if shown, milestone list, official source URL, retrieval timestamp, warnings.

## Team test results

| Carrier | Manual page works | Public result available | TinyFish tested | Best fields available | Demo candidate? |
|---|---|---|---|---|---|
| Maersk | TBD | TBD | TBD | TBD | Priority |
| MSC | TBD | TBD | TBD | TBD | Priority |
| CMA CGM | TBD | TBD | TBD | TBD | Candidate |
| Hapag-Lloyd | TBD | TBD | TBD | TBD | Candidate |
| COSCO | TBD | TBD | TBD | TBD | Candidate |
