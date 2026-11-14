export interface LegalSection {
  id: string;
  title: string;
  html: string;
}

export interface LegalPage {
  path: string;
  title: string;
  description: string;
  label: string;
  sections: LegalSection[];
}

export const legalUpdatedAt = '7 November 2026';

export const mitLicenseText = `MIT License

Copyright (c) 2026 Fluri contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`;

const contact = '<a href="mailto:fluritheme@gmail.com">fluritheme@gmail.com</a>';
const privacySource =
  '<a href="https://www.cloudflare.com/privacypolicy/" rel="external">Cloudflare’s privacy policy</a>';

export const legalPages: LegalPage[] = [
  {
    path: 'privacy/',
    title: 'Privacy policy',
    description:
      'How Fluri handles website requests, optional website participation, aggregate reports, and your choices.',
    label: 'Privacy',
    sections: [
      {
        id: 'at-a-glance',
        title: 'A little winter. A small data footprint.',
        html: '<p>You can read the website and try the snow without registering. The Fluri engine runs in your browser and does not automatically report installations, pointer activity, or visitor impressions to us. We do not sell personal information or build advertising profiles.</p><p>Website owners can separately choose to register a domain, submit daily aggregate counts from their own systems, and request a public community listing. Registration and reporting are optional; they are not requirements of the software license. On fluri.xyz itself, we also count public page requests in daily aggregates, as described below. This notice covers those services, hosting, correspondence, and browser storage.</p>',
      },
      {
        id: 'who-is-responsible',
        title: 'Who is responsible',
        html: `<p>The operator of <strong>fluri.xyz</strong> and the controller for the processing described here is <strong>Frantisek Gejdos, Slovakia</strong>. For privacy questions or to exercise your rights, contact ${contact}.</p><p>This notice covers the Winter website, playground and participation portal. The shared private traffic dashboard is hosted at https://fluri.xyz/dashboard and combines website totals across Fluri Themes. Independently operated websites using Fluri are responsible for their own privacy practices and source analytics. Installing the library does not register a website or send its visitors’ activity to Fluri.</p>`,
      },
      {
        id: 'information-and-purpose',
        title: 'Information and purpose',
        html: '<h3>Page delivery and security</h3><p>Our hosting provider receives information needed to serve and protect the website, such as your IP address, requested URL, request time, browser or device information supplied in HTTP headers, and technical response information. These requests are processed to deliver content, maintain reliability, and prevent abuse. Where the GDPR applies, our basis is our legitimate interest in providing a secure and functioning website.</p><h3>Messages you send us</h3><p>If you email us, we receive your email address, the content of your message, and any details you choose to include. We use them to respond and handle the matter you raise, based on our legitimate interest in answering correspondence. Where your request concerns steps towards a contract, the relevant processing may instead be necessary to take those steps at your request. We do not add you to a marketing list.</p><h3>Browser interactions</h3><p>Pointer positions, snow physics, live performance measurements, and preview controls are processed in browser memory. The application does not send this interaction history or your playground configuration to a Fluri server. Exporting a configuration creates a file locally; copying a command uses your device’s clipboard when you request it.</p>',
      },
      {
        id: 'website-traffic',
        title: 'Traffic on winter.fluri.xyz',
        html: '<p>Our server counts successful requests for public HTML pages to understand which pages are useful and how visitors discover Fluri. From the ordinary request headers, we derive a broad referral category such as LinkedIn, GitHub, npm, Google, internal navigation, direct / unknown, or other websites. Full referrer URLs, query strings, arbitrary referring domains, IP addresses, user-agent strings, visitor identifiers and individual event records are not stored in this traffic database. A browser user-agent header is used transiently to filter common bots; it is not retained. We do not send these requests to a third-party analytics service or install analytics cookies, pixels, fingerprinting code, or browser storage.</p><p>Only the UTC date, public page path, broad source category, aggregate count and latest update time are stored, with up to 90 days of daily totals. The dashboard and API are excluded. Requests carrying Do Not Track or Global Privacy Control are excluded. We do not identify or deduplicate people, measure time on page, or join browsing across websites. Referrers may be missing or inaccurate, repeat opens count again, browser caching can avoid a request, and bot filtering is imperfect.</p><p>Where the GDPR applies, the limited processing of ordinary request metadata for these aggregate statistics is based on our legitimate interest in understanding and improving this website while minimising data and respecting opt-out signals. You can object by contacting us or enabling a supported Do Not Track or Global Privacy Control signal. This first-party request counting is separate from optional reports by independent website owners, and does not change what the Fluri library collects.</p>',
      },
      {
        id: 'website-participation',
        title: 'Optional website participation',
        html: '<h3>Registration and management</h3><p>If you register, we store your chosen display name, domain, contact email, site identifier, DNS verification challenge and verification date, settings, acceptance version and time, and records of your reporting and public-listing choices. Management and reporting credentials are stored as hashes. The service uses these records to verify domain control, provide the participation features you request, and protect access. Providing these registration fields is necessary to use the optional service, but not to browse Fluri or use the library.</p><p>Where the GDPR applies, processing necessary to provide participation you personally request is based on taking steps at your request and performing the participation agreement. Where you act for an organisation, our legitimate interest is administering its requested participation and communicating with its authorised representative. Our legitimate interest in preventing unauthorised access supports credential and security processing.</p><h3>Aggregate reporting</h3><p>A verified owner can enable reporting and send daily totals and the Fluri version from their own backend. We use these totals to understand participating use and maintain the private project dashboard. The reporting API accepts totals rather than visitor-level events. We do not store visitor IP addresses, browser identifiers, fingerprints, individual browsing histories, or page URLs in participation reports. Our hosting provider still processes technical information when a backend contacts our API.</p><p>Reports describe owner-reported effect impressions: an enabled Fluri effect was visible for at least one second while the tab was visible, as measured by the owner’s system. Counts are not unique people, independently verified audiences, or a count of every website using Fluri. Owners must assess the lawfulness of their source collection and sharing; enabling this service does not provide visitor consent or establish an exemption from consent requirements.</p>',
      },
      {
        id: 'public-community',
        title: 'A public listing is a separate choice',
        html: '<p>Allowing aggregate reporting does not permit a public listing. A domain appears in the community only after DNS verification, a separate owner permission, and our approval. That permission covers the submitted display name, domain, and website link. It does not grant a separate right to reproduce logos or screenshots. Contact emails, credentials, and private impression totals are not part of the public listing.</p><p>Where a listing contains personal data, publication is based on the optional permission you give. You can withdraw it in the participation portal; withdrawal removes the listing from the current public service and does not affect the lawfulness of publication before withdrawal. It does not require you to stop using Fluri. Copies previously made by independent third parties are outside our control.</p>',
      },
      {
        id: 'local-preferences',
        title: 'Preferences on your device',
        html: '<p>The website can remember your chosen snow on/off setting, and the playground can save a configuration when you choose <strong>Save locally</strong>. These preferences stay in your browser’s local storage and are not used to identify you. The participant portal keeps entered credentials in page memory rather than browser storage. Leaving or reloading the page clears that in-memory state.</p><p>The private project dashboard sets a necessary, secure session cookie only after its administrator signs in. See the <a href="/cookies/">cookies and local storage page</a> for names, lifetimes, and controls.</p>',
      },
      {
        id: 'providers-and-transfers',
        title: 'Service providers and international processing',
        html: `<p>Cloudflare provides hosting, request protection, DNS resolution for owner-requested verification, and the D1 database used for participation records. That database is configured with EU jurisdiction; network and support processing can still involve other locations. Verifying a domain sends its public DNS challenge name to Cloudflare’s DNS resolver. Cloudflare’s network operates internationally; processing can involve countries outside Slovakia and the European Economic Area, including the United States. Its <a href="https://www.cloudflare.com/cloudflare-customer-dpa/" rel="external">data processing addendum</a> describes processor commitments and applicable transfer mechanisms, including contractual safeguards. Read ${privacySource} for its own processing practices. Contact us to request information about applicable safeguards.</p><p>Participation records and reports are available to the project operator and service providers supporting those features, subject to the separate public-listing choice above. We do not publish an owner’s contact email or private reports. Emails sent to our Gmail address are handled by the email services used by the sender and recipient. We do not add participants to a marketing list. Information may be disclosed when required by law or necessary to protect legal rights.</p><p>README download badges fetch public aggregate package statistics from npm on our server; visitors do not send analytics events to npm through this feature. These totals do not measure installations or visitors on websites using Fluri. Following an external link takes you to that provider’s service and privacy policy.</p>`,
      },
      {
        id: 'retention',
        title: 'How long information is kept',
        html: `<p>Live simulation state lasts for the browser session. Saved motion and playground preferences remain on your device until replaced, cleared, or removed by your browser. An administrator session lasts at most eight hours, or until logout or server-side session revocation.</p><p>First-party website traffic totals are retained for up to 90 days and removed by daily cleanup. Daily owner-submitted aggregate reports are retained for up to 395 days. A daily cleanup removes older reports and unverified registrations older than 30 days. Verified registration, contact, credential-hash, and permission records remain while the owner keeps the registration active. Turning reporting off revokes its reporting credential and stops new reports; existing totals remain until their retention period ends or the registration is deleted. Owners can delete a registration and its reports through the portal, or contact us for help.</p><p>Deleting a registration removes it from the active database and current public community results. Cloudflare D1 recovery history can temporarily contain earlier database states. Its <a href="https://developers.cloudflare.com/d1/reference/time-travel/" rel="external">Time Travel documentation</a> describes the applicable recovery window, currently up to seven days on Workers Free or 30 days on Workers Paid. Recovery copies are not the live service; a recovery must respect previously requested deletions.</p><p>We retain correspondence only as needed to handle the matter and maintain a necessary record, unless a legal obligation or legal claim requires more. Technical hosting and security records follow the provider’s operational, security, and legal retention criteria, described in ${privacySource}.</p>`,
      },
      {
        id: 'your-rights',
        title: 'Your choices and rights',
        html: `<p>Where applicable, you may request access, correction, deletion, restriction, or portability of personal data, object to legitimate-interest processing, and withdraw consent for a public listing without affecting earlier lawful processing. These rights have conditions and exceptions. We do not make automated decisions with legal or similarly significant effects about you.</p><p>The participation portal lets a credential holder view and export their registration and reports, update contact details and choices, and delete the registration. You can also contact ${contact}; we may ask for information reasonably needed to verify your request. If a credential is lost, contact us rather than submitting somebody else’s domain.</p><p>You may complain to the <a href="https://dataprotection.gov.sk/en/" rel="external">Office for Personal Data Protection of the Slovak Republic</a>, or another competent supervisory authority. The <a href="https://commission.europa.eu/law/law-topic/data-protection/information-individuals_en" rel="external">European Commission’s guide</a> explains data protection rights. You can explore the website without participating, pause snow, and clear saved browser preferences.</p>`,
      },
      {
        id: 'updates',
        title: 'Changes to this notice',
        html: `<p>We will update this notice if the website’s data practices change. The revision date on this page identifies the current version. Questions are welcome at ${contact}.</p>`,
      },
    ],
  },
  {
    path: 'terms/',
    title: 'Website terms',
    description:
      'Straightforward terms for exploring the Fluri website, previews, documentation, and downloads.',
    label: 'Terms',
    sections: [
      {
        id: 'about-these-terms',
        title: 'About these terms',
        html: `<p>This website is operated by <strong>Frantisek Gejdos, Slovakia</strong>. You can contact the operator at ${contact}. These terms cover the website, documentation, demonstrations, and optional participation service. The participation terms below are version <strong>2026-11-07</strong>.</p><p>The Fluri software has a separate <a href="/license/">MIT license</a>. These terms do not replace that license or make registration, reporting, or a public listing a condition of using the software.</p>`,
      },
      {
        id: 'using-the-website',
        title: 'Explore, learn, and experiment',
        html: '<p>You are welcome to read the documentation, try the previews, adjust the playground, and download the packages. No account or payment is required to use these website features. Demo controls affect the local demonstration and do not change your own website.</p><p>Use the website lawfully. Do not attempt to gain unauthorised access, interfere with its availability, exploit other visitors, or use it to distribute malicious content.</p>',
      },
      {
        id: 'participation',
        title: 'Optional website participation',
        html: '<p>Register only a domain you own or are authorised to administer. Supply accurate contact details, keep the management credential secure, and verify control through the DNS challenge. Domain verification proves control at the time of verification; it is not an independent certification that Fluri is installed or that submitted traffic is accurate. Notify us or remove the registration if your authority over the domain ends.</p><p>Accepting participation confirms your authority to register and your responsibility for lawful reporting. We record the accepted terms version and time. Reporting and permission for a public community listing are separate choices. You can manage those choices, export your data, and delete the registration through the <a href="/participate/">participation portal</a>. Read the <a href="/reference/participation.md">participation guide</a> for the API and measurement definitions.</p>',
      },
      {
        id: 'aggregate-reports',
        title: 'Report totals responsibly',
        html: '<p>Reporting is available only after domain verification and an explicit reporting choice. Send daily aggregate effect-impression totals and the reported Fluri version from a backend you control. Keep reporting credentials out of browser code, public repositories, logs, and URLs. A new reporting key revokes the old key.</p><p>Do not submit individual events, visitor identifiers, IP addresses, fingerprints, personal page URLs, or other visitor-level data. Send only counts collected and shared lawfully, with required notices, permissions, and visitor consent where applicable. A cookie-free implementation or our acceptance of a report does not establish a legal exemption. Check your own jurisdiction and measurement setup before collecting or sending statistics.</p><p>Reports are owner-supplied and may be incomplete or inaccurate. They measure reported impressions, not unique people or all Fluri installations. Do not fabricate or inflate counts. We may reject reports, suspend participation, or remove a listing to prevent abuse or address a rights request. You can stop reporting without affecting your software-license rights.</p>',
      },
      {
        id: 'community-permission',
        title: 'Public community permission',
        html: '<p>Requesting a public listing permits us to show the submitted display name, verified domain, and a website link in the Fluri community, subject to review. Give this permission only if you have authority to do so. A listing does not imply endorsement by either party. It does not give us permission to reproduce a separate company logo, screenshot, or other protected asset.</p><p>We do not promise approval, placement, continued listing, or promotion. You can withdraw permission in the portal, which removes the listing from current community results. Private contact information and aggregate reports remain separate from this permission and are handled as described in the <a href="/privacy/">privacy policy</a>.</p>',
      },
      {
        id: 'software-and-downloads',
        title: 'Software and downloads',
        html: '<p>Fluri is distributed under the MIT license. It permits use, modification, and redistribution, including commercial use, subject to its copyright and license notice requirements. Read the <a href="/license/">complete license</a> supplied with the software.</p><p>The documentation describes the available APIs and known limitations. Test the library against your own layout, target browsers, devices, accessibility needs, and performance budget before production use. Demonstrations are examples, not promises of a particular visual or frame-rate result on every website.</p><p>Package downloads are versioned. A package name or installation example does not by itself guarantee availability in a third-party registry; follow the current <a href="/docs/">getting-started instructions</a>.</p>',
      },
      {
        id: 'content-and-brand',
        title: 'Content and identity',
        html: '<p>Software and accompanying documentation are subject to the license notices supplied with them. Do not remove required copyright or license notices when redistributing licensed materials. Using the website does not grant permission to misrepresent an affiliation with, or endorsement by, Fluri or its contributors.</p>',
      },
      {
        id: 'availability',
        title: 'Availability and changes',
        html: '<p>We aim to keep the site useful and accurate, but access may be interrupted and content, previews, or downloads may change. We do not promise uninterrupted access, support response times, or compatibility with every browser or website.</p><p>The software’s warranty and liability provisions are set out in its MIT license. Website information is provided for general product and technical guidance. Nothing in these terms excludes or limits liability or rights that cannot lawfully be excluded or limited.</p>',
      },
      {
        id: 'external-services',
        title: 'External links and privacy',
        html: '<p>The website may link to third-party documentation, hosting policies, or other resources. Those services are operated independently and have their own terms. Their inclusion does not mean that we control them or endorse all of their content.</p><p>Our <a href="/privacy/">privacy policy</a> explains technical hosting data, email correspondence, and browser preferences. The <a href="/cookies/">cookies and local storage page</a> describes local storage in more detail.</p>',
      },
      {
        id: 'questions-and-updates',
        title: 'Questions and updates',
        html: `<p>Contact ${contact} with questions about the website or these terms. Any updated terms will be published here with their revision date.</p>`,
      },
    ],
  },
  {
    path: 'cookies/',
    title: 'Cookies & local storage',
    description:
      'The small preferences Fluri can remember on your device, and how you can remove them.',
    label: 'Cookies & storage',
    sections: [
      {
        id: 'our-approach',
        title: 'Your forecast stays with you',
        html: '<p>The Fluri application does not set advertising, audience-measurement, or cross-site tracking cookies. The snow engine runs in memory. This website can save two local preferences, and the private project dashboard uses a necessary session cookie after administrator login.</p><p>Optional participation is separate from the engine: owners can send aggregate reports from their own backends. There is no automatic visitor reporting module in the library. On fluri.xyz, our server separately aggregates ordinary public page requests without analytics cookies or visitor identifiers; see the <a href="/privacy/#website-traffic">privacy policy</a>. Local storage is kept by your browser and is not automatically included with requests; our application does not upload the saved snow preferences.</p>',
      },
      {
        id: 'stored-values',
        title: 'What can be saved',
        html: '<div class="table-scroll"><table><thead><tr><th scope="col">Storage key</th><th scope="col">Purpose</th><th scope="col">When it is saved</th><th scope="col">Lifetime</th></tr></thead><tbody><tr><th scope="row"><code>fluri:motion:v1</code></th><td>Local storage remembering the website snow setting, <code>on</code> or <code>off</code>.</td><td>When you change the website snow setting.</td><td>Until replaced, cleared, or removed by your browser.</td></tr><tr><th scope="row"><code>fluri:configuration:v1</code></th><td>Local storage for your playground configuration.</td><td>Only when you choose <strong>Save locally</strong>.</td><td>Until replaced, cleared, or removed by your browser.</td></tr><tr><th scope="row"><code>__Host-fluri_session</code></th><td>First-party, HttpOnly, Secure, SameSite=Strict cookie authenticating the private project administrator. It is not an analytics identifier.</td><td>After successful dashboard login.</td><td>At most eight hours; cleared by logout. Server-side session revocation invalidates existing sessions.</td></tr></tbody></table></div><p>The portal does not save owner management or reporting credentials to cookies, local storage, or session storage. Entered credentials remain in page memory until you leave or reload the page. Keep your own secure copy if you want to manage the registration later.</p>',
      },
      {
        id: 'dashboard-session',
        title: 'Private dashboard authentication',
        html: '<p>Signing in to the operator dashboard sets <code>__Host-fluri_session</code>, a random session credential used only to authorize dashboard access. It has the HttpOnly, Secure and SameSite=Strict attributes, applies to fluri.xyz, and expires after eight hours or when you sign out. This cookie is necessary to provide the signed-in service you request; it is not used for audience measurement or advertising. Owners using the participation portal authenticate with management keys held in page memory; the portal does not persist those keys in local storage.</p>',
      },
      {
        id: 'hosting-security',
        title: 'Cloudflare security',
        html: '<p>Cloudflare delivers and protects this website. Depending on the security features applied to a request, Cloudflare may use necessary security or challenge cookies. These are separate from the Fluri application’s local preferences. We do not use them for advertising.</p><p><a href="https://developers.cloudflare.com/fundamentals/reference/policies-compliances/cloudflare-cookies/" rel="external">Cloudflare’s cookie documentation</a> explains its security cookies and when each is used. Not every cookie in that documentation is used on this website.</p>',
      },
      {
        id: 'your-controls',
        title: 'Change or remove your preferences',
        html: '<p>Use the website’s snow control to change your motion preference. Your device’s reduced-motion setting is respected independently. To remove saved values, clear this website’s cookies and site data in your browser. Export a playground configuration first if you want to keep it.</p><p>Dashboard logout removes its session cookie. Clearing site data also signs that browser out. Blocking the dashboard cookie prevents authenticated dashboard use; it does not stop you from reading the public site or using the library. Blocking provider security cookies can affect access when a challenge is required.</p>',
      },
      {
        id: 'more-information',
        title: 'More information',
        html: `<p>Read the <a href="/privacy/">privacy policy</a> for the operator’s contact details, processing purposes, hosting information, and your rights. For questions about browser storage on Fluri, email ${contact}.</p>`,
      },
    ],
  },
  {
    path: 'license/',
    title: 'The MIT license',
    description: 'Free to use, adapt, and share. Read the complete license that accompanies Fluri.',
    label: 'License',
    sections: [
      {
        id: 'what-it-means',
        title: 'Make it part of your winter',
        html: '<p>Fluri uses the MIT license. You can use it in personal and commercial projects, modify it, and redistribute it. Keep the copyright and license notice with copies or substantial portions of the software. The full terms below are the authoritative license text.</p>',
      },
      {
        id: 'full-license',
        title: 'Full license text',
        html: `<pre class="license-copy">${mitLicenseText.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')}</pre>`,
      },
      {
        id: 'questions',
        title: 'Questions about Fluri',
        html: `<p>The license text above is also included with the software distribution. For project questions, contact ${contact}. Website use is described in the <a href="/terms/">website terms</a>, and data handling in the <a href="/privacy/">privacy policy</a>.</p>`,
      },
    ],
  },
];
