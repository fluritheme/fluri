# Website participation and aggregate reporting

Fluri runs locally by default. Installing the core or React package does not register a website, send telemetry, or load an analytics service. Participation is separate and optional.

## Register and verify

Open [Share your website](https://fluri.xyz/participate/), enter a domain you control, a website name and contact email, and accept the participation terms. Choose aggregate reporting and public listing permission independently. Save the management key securely: it is displayed once, stored only as a hash on the server, and never persisted in browser storage by the portal. It grants access to that registration, including export and deletion. If lost, contact fluritheme@gmail.com for a manual ownership review; email possession alone is not proof of domain ownership.

Create the exact TXT record shown by the portal at `_fluri-verification` under your registered domain, then choose **Check DNS record**. The service queries Cloudflare's public DNS resolver. Propagation can take time. Verification proves control of a domain, not that Fluri is installed or that submitted statistics are independently verified. Use the management key in the portal to update contact and sharing settings.

## Aggregate reporting

After domain verification, enable reporting and create a reporting key. Store it in your own backend's secret manager. Never embed either key in browser JavaScript, HTML, public repositories, URLs, or logs. Creating another reporting key immediately revokes the previous key. Turning reporting off also revokes it.

A reported **effect impression** means Fluri was enabled and visible on screen for at least one continuous second while the browser tab was visible. Use your own lawful measurement to count that event and aggregate daily totals. The Fluri package does not perform this measurement for you. Counts are owner-reported, can include repeat views, and are not unique people, independent audits, or a measure of all Fluri installations.

The endpoint accepts one total per registered domain per UTC calendar date. Submitting the same date replaces its previous total, making retries safe. Report dates must be within the current UTC date and preceding 29 days. Zero is a valid measured total; missing dates are missing reports, not evidence of zero activity. One optional semantic Fluri version may describe that day's reported deployment; omit it or use an empty string if unknown. Mixed-version deployment counts cannot be distinguished by this daily format.

With `FLURI_REPORTING_KEY` set in your backend environment, this executable Node.js example sends **your own measured totals**, read from environment variables rather than sample visitor data:

```js
const impressions = Number(process.env.FLURI_DAILY_IMPRESSIONS);
const date = process.env.FLURI_REPORT_DATE;
if (!Number.isSafeInteger(impressions) || impressions < 0 || !date) {
  throw new Error('Provide the measured daily total and UTC report date.');
}
const response = await fetch('https://fluri.xyz/api/participation/report', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${process.env.FLURI_REPORTING_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    date,
    impressions,
    version: process.env.FLURI_DEPLOYED_VERSION ?? '',
    measurement: 'visible-1s',
  }),
});
if (!response.ok) throw new Error(`Reporting failed: HTTP ${response.status}`);
```

The portal also supports manual daily submission with a reporting key. Never send IP addresses, visitor identifiers, user agents, referrers, full page URLs, event histories, or individual-level records. The endpoint rejects unexpected fields. Only date, total, version, and measurement definition are accepted. Fluri processes technical requests to deliver and secure the service; Cloudflare still receives network metadata.

## Privacy responsibilities

Website-owner participation does not replace any visitor consent your measurement requires. Collect source statistics lawfully, provide appropriate notices, and obtain consent where required. Cookie-free measurement is not automatically exempt. Sending anonymized totals server-to-server avoids adding a Fluri tracking request to visitors' browsers, but does not make an unlawful source collection lawful. Fluri currently supplies no visitor analytics module, cross-site identifiers, or consent-management tool.

See the [EDPB guidance on the technical scope of Article 5(3)](https://www.edpb.europa.eu/our-work-tools/our-documents/guidelines/guidelines-22023-technical-scope-art-53-eprivacy-directive_en), the [CNIL audience-measurement guidance](https://www.cnil.fr/fr/cookies-solutions-pour-les-outils-de-mesure-daudience), and the website's [privacy policy](https://fluri.xyz/privacy/). Requirements depend on the actual implementation and jurisdiction; these tools are not a universal legal certification.

## Community listing

Public display of your website name and HTTPS domain link requires separate owner permission, verified domain control, and operator approval. It does not authorize using your logo or screenshots. Private reports and contact details are never exposed by the community endpoint. Withdraw permission in sharing settings to remove the listing immediately. A changed website name requires renewed operator review. A listing is not an endorsement by either party.

## Private operator dashboard

[The dashboard](https://fluri.xyz/dashboard/) requires a separate operator access key. Successful login creates an eight-hour HttpOnly, Secure, SameSite=Strict cookie. The dashboard and API responses are not cached or indexed. It refreshes while visible, at one-minute intervals; owner submissions may be daily or less frequent.

- **Registered websites:** registrations in the database, including domains awaiting verification.
- **Verified domains:** domains whose TXT ownership check succeeded.
- **Confirmed live examples:** integrations manually reviewed by the operator in the preceding 30 days. DNS verification alone does not qualify.
- **Recently reporting websites:** registrations that submitted a report in the preceding 30 days, including measured zero totals.
- **Community approvals:** verified domains with active owner permission and operator approval.
- **Impressions over 30 days:** sum of supplied totals for the current UTC day and preceding 29 days; not unique visitors and not all installations.

Inspect a website before confirming that Fluri is running. Version statistics come from reports and may reflect several versions per site over the reporting window. Exports contain private contact information: handle them accordingly.

## Retention, deletion, and API access

Daily reports are retained for up to 395 days, unverified registrations for up to 30 days, and operator sessions for eight hours. A scheduled cleanup runs daily, so expired rows can remain until that day's cleanup. Verified registration details remain until deletion or an operational/legal need ends. Owners can export or delete their registration and reports from the portal. Live database deletion cascades to reports and invalidates the keys. Provider point-in-time backups expire on Cloudflare's applicable retention schedule; if a database is restored, the operator must reapply subsequent deletion and permission-withdrawal requests before reopening service.

Owner API operations use `Authorization: Bearer` with the management key:

| Method | Endpoint                           | Purpose                                                                    |
| ------ | ---------------------------------- | -------------------------------------------------------------------------- |
| GET    | `/api/participation/site`          | Registration, verification record, and reports                             |
| PATCH  | `/api/participation/site`          | Update name, email and sharing settings; include current terms attestation |
| DELETE | `/api/participation/site`          | Delete registration and associated reports                                 |
| GET    | `/api/participation/export`        | Export registration and reports                                            |
| POST   | `/api/participation/verify`        | Check the displayed DNS TXT record                                         |
| POST   | `/api/participation/reporting-key` | Rotate the server-only reporting key                                       |

POST operations above require an empty JSON object except for daily reporting. PATCH requires `displayName`, `contactEmail`, `analyticsEnabled`, `showcasePermission`, and `analyticsAttestation: true`. Requests are limited to 4 KiB. API rate limits are enforced by Cloudflare per network location (60 requests/minute per daily-hashed address; dashboard login 5/minute). Hosting protection complements these limits; they are not a global quota or a guarantee against automated abuse. No wildcard CORS permission is exposed. Browser requests must originate from the same origin; backend reporting uses the bearer key without browser-origin headers.
