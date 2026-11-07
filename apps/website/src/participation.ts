import { renderGrowth } from './growth';
import type { growthStatistics } from '../../../workers/growth';
interface Site {
  id: string;
  domain: string;
  displayName: string;
  contactEmail: string;
  createdAt: string;
  verifiedAt: string | null;
  lastReportedAt: string | null;
  liveConfirmedAt: string | null;
  analyticsEnabled: boolean;
  showcasePermission: boolean;
  showcaseApprovedAt: string | null;
}
interface Report {
  date: string;
  impressions: number;
  version: string;
}
interface Owner {
  site: Site;
  verification: { name: string; value: string };
  reports: Report[];
}
interface Dashboard {
  metrics: Record<string, number>;
  sites: Site[];
  daily: { date: string; impressions: number }[];
  versions: { version: string; sites: number; impressions: number }[];
}
const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T | null;
const escape = (value: string | number) =>
  String(value).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c,
  );
const number = (value: number) => new Intl.NumberFormat('en').format(value);
const date = (value: string | null) =>
  value
    ? new Date(value).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : 'Not yet';
let managementToken = '';
function notice(id: string, message = '', error = false) {
  const el = $(id);
  if (el) {
    el.textContent = message;
    el.dataset.error = String(error);
  }
}
async function api<T>(path: string, method = 'GET', data?: unknown, token?: string): Promise<T> {
  const headers: Record<string, string> = {};
  if (data !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      headers,
      signal: AbortSignal.timeout(15000),
      ...(data !== undefined ? { body: JSON.stringify(data) } : {}),
    });
  } catch {
    throw new Error('Could not connect to Fluri. Check your connection and try again.');
  }
  if (response.status === 401 && path.startsWith('/api/dashboard') && $('dashboard-content')) {
    dashboardVisible = false;
    $('dashboard-content')!.replaceChildren();
    $('dashboard-content')!.hidden = true;
    $('dashboard-login')!.hidden = false;
  }
  const fallback =
    response.status === 401
      ? path === '/api/dashboard/login'
        ? 'Invalid dashboard access key.'
        : 'Your session has ended. Sign in again.'
      : response.status === 429
        ? 'Too many requests. Wait a minute and try again.'
        : response.status === 403
          ? 'The request was blocked. Reload the page and try again.'
          : response.status >= 500
            ? 'The service is temporarily unavailable. Please try again shortly.'
            : 'The service returned an unexpected response. Reload the page and try again.';
  let result: unknown;
  try {
    result = await response.json();
  } catch {
    throw new Error(fallback);
  }
  if (typeof result !== 'object' || result === null || Array.isArray(result))
    throw new Error(fallback);
  if (!response.ok) {
    throw new Error(
      'error' in result && typeof result.error === 'string' && result.error.trim()
        ? result.error
        : fallback,
    );
  }
  return result as T;
}
function submit(
  id: string,
  action: (data: FormData, form: HTMLFormElement) => Promise<void>,
  noticeID: string,
) {
  const form = $<HTMLFormElement>(id);
  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    void (async () => {
      const button = form.querySelector<HTMLButtonElement>('[type=submit]');
      if (button) button.disabled = true;
      notice(noticeID, 'Working…');
      try {
        await action(new FormData(form), form);
      } catch (error) {
        notice(
          noticeID,
          error instanceof Error ? error.message : 'Something went wrong. Try again.',
          true,
        );
      } finally {
        if (button) button.disabled = false;
      }
    })();
  });
}
function download(value: unknown, filename: string) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function bind(id: string, action: () => Promise<void>, noticeID: string) {
  $(id)?.addEventListener('click', () => {
    void (async () => {
      const button = $<HTMLButtonElement>(id);
      if (button) button.disabled = true;
      try {
        await action();
      } catch (error) {
        notice(noticeID, error instanceof Error ? error.message : 'Request failed.', true);
      } finally {
        if (button) button.disabled = false;
      }
    })();
  });
}
function secret(title: string, token: string): HTMLElement {
  const box = document.createElement('section');
  box.className = 'service-secret';
  const heading = document.createElement('h3');
  heading.textContent = title;
  const copy = document.createElement('p');
  copy.textContent =
    'Save this key securely now. It is shown only once. Keys grant access to your site; keep them out of public code and repositories.';
  const field = document.createElement('textarea');
  field.readOnly = true;
  field.value = token;
  field.setAttribute('aria-label', title);
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'service-small-button';
  button.textContent = 'Copy key';
  button.addEventListener('click', () => {
    void navigator.clipboard
      .writeText(token)
      .then(() => {
        button.textContent = 'Copied';
      })
      .catch(() => {
        field.select();
        button.textContent = 'Select and copy the key';
      });
  });
  box.append(heading, copy, field, button);
  return box;
}
function table(reports: Report[], includeVersion = true) {
  return reports.length
    ? `<div class="service-table-wrap"><table class="service-table"><caption>Owner-reported daily totals. Re-submitting a date replaces its total.</caption><thead><tr><th>Date (UTC)</th><th>Impressions</th>${includeVersion ? '<th>Version</th>' : ''}</tr></thead><tbody>${reports.map((r) => `<tr><td>${escape(r.date)}</td><td>${number(r.impressions)}</td>${includeVersion ? `<td>${escape(r.version || 'Not reported')}</td>` : ''}</tr>`).join('')}</tbody></table></div>`
    : '<p class="service-empty">No reports yet. Enable reporting and verify your domain to submit daily totals.</p>';
}
function config(data: FormData) {
  return {
    displayName: String(data.get('displayName') ?? ''),
    contactEmail: String(data.get('contactEmail') ?? ''),
    analyticsEnabled: data.has('analyticsEnabled'),
    showcasePermission: data.has('showcasePermission'),
    analyticsAttestation: data.has('analyticsAttestation'),
  };
}
async function openOwner() {
  const result = await api<Owner>('/api/participation/site', 'GET', undefined, managementToken);
  const panel = $('owner-workspace');
  if (!panel) return;
  $('register-panel')!.hidden = true;
  $('manage-panel')!.hidden = true;
  panel.hidden = false;
  const s = result.site;
  panel.innerHTML = `<section class="service-card"><div class="service-toolbar"><h2>${escape(s.displayName)}</h2><span class="service-badge ${s.verifiedAt ? 'is-verified' : 'is-pending'}">${s.verifiedAt ? 'Domain verified' : 'Verification needed'}</span></div><p class="service-domain">${escape(s.domain)}</p><p>Domain verification confirms control of the domain. Fluri integrations are reviewed separately.</p><dl class="verification-record"><div><dt>DNS record type</dt><dd>TXT</dd></div><div><dt>Record name</dt><dd>${escape(result.verification.name)}</dd></div><div><dt>Record value</dt><dd>${escape(result.verification.value)}</dd></div></dl><div class="service-toolbar-actions"><button id="verify-domain" class="service-small-button">Check DNS record</button><button id="export-site" class="service-small-button">Export my data</button><button id="close-owner" class="service-small-button">Close site</button></div><details class="service-details"><summary>Sharing settings &amp; contact</summary><form id="update-site" class="service-form"><label>Website name<input name="displayName" value="${escape(s.displayName)}" maxlength="80" required/></label><label>Contact email<input name="contactEmail" type="email" value="${escape(s.contactEmail)}" maxlength="254" required/></label><label class="check-field"><input type="checkbox" name="analyticsEnabled" ${s.analyticsEnabled ? 'checked' : ''}/><span>Enable private aggregate reporting. Turning this off revokes your reporting key.</span></label><label class="check-field"><input type="checkbox" name="showcasePermission" ${s.showcasePermission ? 'checked' : ''}/><span>Permit Fluri to list my website name and domain publicly after review.</span></label><label class="check-field"><input type="checkbox" name="analyticsAttestation" required/><span>I remain authorized to manage this site and accept the <a href="/terms/">participation terms</a>. Counts I share are lawfully collected aggregates.</span></label><button type="submit" class="button button-dark">Save settings</button></form></details></section><section class="service-card"><h3>Your aggregate reports</h3><p>An impression means the effect was enabled and visible for at least one second in a visible tab. Totals are supplied by you, not measured by Fluri, and are not unique people.</p>${table(result.reports)}<button id="create-report-key" class="service-small-button" ${!s.analyticsEnabled || !s.verifiedAt ? 'disabled' : ''}>Create / rotate reporting key</button><div id="report-secret"></div><details class="service-details"><summary>Submit a daily total manually</summary><p>Use your reporting key. The same key also works from your backend. <a href="/reference/participation.md">Reporting guide</a></p><form id="submit-report" class="service-form"><label>Reporting key<input type="password" name="token" required autocomplete="off"/></label><label>UTC date<input name="date" type="date" max="${new Date().toISOString().slice(0, 10)}" required/></label><label>Daily effect impressions<input name="impressions" type="number" min="0" max="1000000000" step="1" required/></label><label>Fluri version (optional)<input name="version" maxlength="40"/></label><button type="submit" class="button button-dark">Save daily total</button></form></details></section><section class="service-card service-danger"><h3>Leave the programme</h3><p>Deleting your registration removes the public listing, access keys, and daily reports from the live database. Provider backups expire separately.</p><button id="delete-site" class="service-small-button danger">Delete website and reports</button><div id="delete-confirm"></div></section>`;
  bind(
    'verify-domain',
    async () => {
      await api('/api/participation/verify', 'POST', {}, managementToken);
      await openOwner();
      notice('participation-notice', 'Domain verified.');
    },
    'participation-notice',
  );
  bind(
    'export-site',
    async () =>
      download(
        await api('/api/participation/export', 'GET', undefined, managementToken),
        'fluri-site.json',
      ),
    'participation-notice',
  );
  bind(
    'close-owner',
    async () => {
      managementToken = '';
      panel.replaceChildren();
      panel.hidden = true;
      $('manage-panel')!.hidden = false;
      notice('participation-notice', 'Management key cleared from this page.');
    },
    'participation-notice',
  );
  submit(
    'update-site',
    async (data) => {
      await api('/api/participation/site', 'PATCH', config(data), managementToken);
      await openOwner();
      notice('participation-notice', 'Settings saved.');
    },
    'participation-notice',
  );
  bind(
    'create-report-key',
    async () => {
      const data = await api<{ reportingToken: string }>(
        '/api/participation/reporting-key',
        'POST',
        {},
        managementToken,
      );
      $('report-secret')!.replaceChildren(secret('Server-side reporting key', data.reportingToken));
      notice(
        'participation-notice',
        'Reporting key created. Any previous reporting key has been revoked.',
      );
    },
    'participation-notice',
  );
  submit(
    'submit-report',
    async (data) => {
      await api(
        '/api/participation/report',
        'POST',
        {
          date: data.get('date'),
          impressions: Number(data.get('impressions')),
          version: data.get('version'),
          measurement: 'visible-1s',
        },
        String(data.get('token')),
      );
      await openOwner();
      notice('participation-notice', 'Daily aggregate saved.');
    },
    'participation-notice',
  );
  bind(
    'delete-site',
    async () => {
      const confirm = $('delete-confirm')!;
      confirm.innerHTML =
        '<p>Delete this website and all its reports? This cannot be undone here.</p><button id="confirm-delete" class="service-small-button danger">Yes, delete my website</button>';
      bind(
        'confirm-delete',
        async () => {
          await api('/api/participation/site', 'DELETE', undefined, managementToken);
          managementToken = '';
          panel.replaceChildren();
          panel.hidden = true;
          $('register-panel')!.hidden = false;
          notice('participation-notice', 'Your website and reports have been deleted.');
        },
        'participation-notice',
      );
    },
    'participation-notice',
  );
}
for (const mode of ['register', 'manage'])
  $(`${mode}-tab`)?.addEventListener('click', () => {
    for (const candidate of ['register', 'manage']) {
      $(`${candidate}-panel`)!.hidden = candidate !== mode;
      $(`${candidate}-tab`)!.setAttribute('aria-pressed', String(candidate === mode));
    }
    $('owner-workspace')!.hidden = true;
    notice('participation-notice');
  });
submit(
  'register-site',
  async (data, form) => {
    const result = await api<{ managementToken: string }>('/api/participation/register', 'POST', {
      ...config(data),
      domain: data.get('domain'),
    });
    managementToken = result.managementToken;
    form.reset();
    await openOwner();
    $('owner-workspace')!.prepend(secret('Your management key', managementToken));
    notice(
      'participation-notice',
      'Registered. Save your key, then add the DNS verification record.',
    );
  },
  'participation-notice',
);
submit(
  'manage-site',
  async (data, form) => {
    managementToken = String(data.get('managementToken'));
    try {
      await openOwner();
      form.reset();
      notice('participation-notice', 'Your website is open.');
    } catch (error) {
      managementToken = '';
      throw error;
    }
  },
  'participation-notice',
);
let dashboardVisible = false;
async function loadDashboard() {
  const result = await api<Dashboard>('/api/dashboard');
  $('dashboard-login')!.hidden = true;
  const panel = $('dashboard-content')!;
  const previousGrowth = $('growth-statistics');
  panel.hidden = false;
  dashboardVisible = true;
  const labels: [string, string, string][] = [
    ['impressions30d', 'Impressions · 30 days', 'Owner-reported totals, not people'],
    ['registeredWebsites', 'Registered websites', 'Participating registrations'],
    ['verifiedDomains', 'Verified domains', 'DNS ownership confirmed'],
    ['confirmedLiveExamples', 'Confirmed live examples', 'Manually reviewed within 30 days'],
    ['recentlyReportingWebsites', 'Reporting websites', 'A report submitted within 30 days'],
    ['showcaseApprovals', 'Community approvals', 'Verified, permitted, and approved'],
  ];
  const max = Math.max(1, ...result.daily.map((d) => d.impressions));
  const points = result.daily
    .map(
      (d) =>
        `${20 + (((Date.parse(d.date) - Date.parse(new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10))) / 86400000) * 560) / 29},${150 - (130 * d.impressions) / max}`,
    )
    .join(' ');
  panel.innerHTML = `<div class="service-toolbar"><h2>Your private forecast</h2><div class="service-toolbar-actions"><button id="refresh-dashboard" class="service-small-button">Refresh</button><button id="export-dashboard" class="service-small-button">Export data</button><button id="logout-dashboard" class="service-small-button">Sign out</button></div></div><section id="growth-statistics" aria-label="Growth statistics"><p class="service-empty">Loading website and npm statistics…</p></section><div class="dashboard-metrics">${labels.map(([key, label, help]) => `<article class="metric-card"><p>${label}</p><strong>${number(result.metrics[key] ?? 0)}</strong><small>${help}</small></article>`).join('')}</div><div class="dashboard-grid"><section class="service-card"><h3>Daily effect impressions</h3><p>UTC daily totals over the last 30 days. Missing reports are outside our coverage.</p>${
    result.daily.length
      ? `<svg class="impression-chart" viewBox="0 0 600 170" role="img" aria-label="Daily impression totals; exact values in the table below"><path class="chart-rule" d="M20 150H580"/><polyline class="chart-line" points="${points}"/></svg>${table(
          result.daily.map((d) => ({ ...d, version: '' })),
          false,
        )}`
      : '<p class="service-empty">No impression reports yet.</p>'
  }</section><section class="service-card"><h3>Reported Fluri versions</h3>${result.versions.length ? `<ul class="version-list">${result.versions.map((v) => `<li><strong>${escape(v.version || 'Not reported')}</strong><span>${number(v.sites)} sites · ${number(v.impressions)} impressions</span></li>`).join('')}</ul>` : '<p class="service-empty">Versions will appear with daily reports.</p>'}<p class="fine-print">Owner supplied data can be incomplete or inaccurate. These are not unique visitors, all installations, or independently verified exposure counts.</p></section></div><section class="service-card dashboard-sites"><h3>Participating websites</h3>${result.sites.length ? `<div class="service-table-wrap"><table class="service-table"><thead><tr><th>Website</th><th>Ownership</th><th>Reporting</th><th>Community permission</th><th>Review</th></tr></thead><tbody>${result.sites.map((s) => `<tr><td><strong>${escape(s.displayName)}</strong><a class="site-contact" href="https://${escape(s.domain)}/" target="_blank" rel="noopener noreferrer">${escape(s.domain)} ↗</a><span class="site-contact">${escape(s.contactEmail)}</span></td><td>${s.verifiedAt ? `Verified ${date(s.verifiedAt)}` : 'Pending'}</td><td>${s.analyticsEnabled ? 'Enabled' : 'Off'}<span class="site-contact">Last report: ${date(s.lastReportedAt)}</span></td><td>${s.showcasePermission ? 'Owner permitted' : 'No permission'}<span class="site-contact">${s.showcaseApprovedAt ? 'Approved' : 'Not approved'}</span></td><td><div class="table-actions"><button class="service-small-button" data-site="${s.id}" data-action="showcase" ${!s.verifiedAt || !s.showcasePermission ? 'disabled' : ''}>${s.showcaseApprovedAt ? 'Remove listing' : 'Approve listing'}</button><button class="service-small-button" data-site="${s.id}" data-action="live" ${!s.verifiedAt ? 'disabled' : ''}>${s.liveConfirmedAt ? 'Clear live review' : 'Confirm live review'}</button><button class="service-small-button danger" data-site="${s.id}" data-action="delete">Delete</button></div><span class="site-contact">Live review: ${date(s.liveConfirmedAt)}</span></td></tr>`).join('')}</tbody></table></div>` : '<p class="service-empty"><strong>A fresh forecast.</strong>No websites have registered yet.</p>'}</section><p class="fine-print">Updates refresh every minute while this tab is visible. Review a website before marking its Fluri integration live; DNS ownership alone does not prove installation.</p>`;
  if (previousGrowth) $('growth-statistics')!.replaceWith(previousGrowth);
  bind('refresh-dashboard', loadDashboard, 'dashboard-notice');
  bind(
    'export-dashboard',
    async () => download(await api('/api/dashboard/export'), 'fluri-dashboard.json'),
    'dashboard-notice',
  );
  bind(
    'logout-dashboard',
    async () => {
      await api('/api/dashboard/logout', 'POST', {});
      dashboardVisible = false;
      panel.replaceChildren();
      panel.hidden = true;
      $('dashboard-login')!.hidden = false;
      notice('dashboard-notice', 'Signed out.');
    },
    'dashboard-notice',
  );
  for (const button of panel.querySelectorAll<HTMLButtonElement>('[data-site]'))
    button.addEventListener('click', () => {
      void (async () => {
        const s = result.sites.find((site) => site.id === button.dataset.site);
        if (!s) return;
        button.disabled = true;
        try {
          if (button.dataset.action === 'delete') {
            if (!window.confirm(`Delete ${s.domain} and all its reports?`)) return;
            await api(`/api/dashboard/sites/${s.id}`, 'DELETE');
          } else
            await api(
              `/api/dashboard/sites/${s.id}`,
              'PATCH',
              button.dataset.action === 'showcase'
                ? { showcaseApproved: !s.showcaseApprovedAt }
                : { liveConfirmed: !s.liveConfirmedAt },
            );
          await loadDashboard();
          notice('dashboard-notice', 'Website updated.');
        } catch (error) {
          notice(
            'dashboard-notice',
            error instanceof Error ? error.message : 'Request failed.',
            true,
          );
        } finally {
          button.disabled = false;
        }
      })();
    });
  try {
    const growth = await api<Awaited<ReturnType<typeof growthStatistics>>>('/api/dashboard/growth');
    const element = $('growth-statistics');
    if (dashboardVisible && element) {
      const openCharts = new Set(
        [...element.querySelectorAll<HTMLDetailsElement>('details[open][data-chart]')].map(
          (item) => item.dataset.chart,
        ),
      );
      element.innerHTML = renderGrowth(growth);
      for (const details of element.querySelectorAll<HTMLDetailsElement>('details[data-chart]'))
        details.open = openCharts.has(details.dataset.chart);
    }
  } catch (error) {
    const growth = $('growth-statistics');
    if (growth) {
      growth.replaceChildren();
      const message = document.createElement('p');
      message.className = 'service-empty';
      message.textContent =
        error instanceof Error
          ? error.message
          : 'Could not load growth statistics. Use Refresh to retry.';
      growth.append(message);
    }
  }
}
submit(
  'dashboard-login-form',
  async (data, form) => {
    await api('/api/dashboard/login', 'POST', { password: data.get('password') });
    form.reset();
    await loadDashboard();
    notice('dashboard-notice', 'Signed in.');
  },
  'dashboard-notice',
);
if ($('dashboard-content')) {
  void loadDashboard().catch(() => {
    dashboardVisible = false;
  });
  setInterval(() => {
    if (dashboardVisible && !document.hidden)
      void loadDashboard().catch((error) => {
        notice(
          'dashboard-notice',
          error instanceof Error ? error.message : 'Could not refresh.',
          true,
        );
      });
  }, 60000);
}
if ($('community-sites'))
  void (async () => {
    try {
      const result = await api<{ sites: { domain: string; displayName: string }[] }>(
        '/api/community',
      );
      $('community-sites')!.innerHTML = result.sites.length
        ? result.sites
            .map(
              (s) =>
                `<article class="community-card"><div class="community-card-mark"><span aria-hidden="true">✳</span><small>Shared with permission</small></div><h3>${escape(s.displayName)}</h3><p>${escape(s.domain)}</p><a class="text-link" href="https://${escape(s.domain)}/" target="_blank" rel="noopener noreferrer">Visit website ↗</a></article>`,
            )
            .join('')
        : '<div class="service-empty"><strong>The first tracks are still ahead.</strong>Be the first to share your Fluri website. Listings appear after ownership verification, permission, and review.</div>';
      notice('community-notice');
    } catch (error) {
      notice(
        'community-notice',
        error instanceof Error ? error.message : 'Could not load the community.',
        true,
      );
    }
  })();
