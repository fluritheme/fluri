export function structuredData(
  origin: string,
  path: string,
  title: string,
  description: string,
  version: string,
): string {
  if (!origin || path === '404.html' || path === 'dashboard/') return '';
  const page = new URL(path, `${origin}/`).href;
  const data = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${origin}/#website`,
        url: `${origin}/`,
        name: 'Winter by Fluri',
        description:
          'Interactive snowfall and DOM-aware snow accumulation for JavaScript and TypeScript websites.',
        inLanguage: 'en',
      },
      {
        '@type': 'Person',
        '@id': 'https://fluri.xyz/#founder',
        name: 'František Gejdoš',
        alternateName: 'Frantisek Gejdos',
        url: 'https://fluri.xyz/founder/',
        description: 'Founder of Fluri Themes and creator of Winter and Spider website effects.',
        sameAs: [
          'https://www.instagram.com/gejdosfrantisek/',
          'https://www.linkedin.com/in/gejdosfrantisek/',
        ],
        worksFor: { '@id': 'https://fluri.xyz/#organization' },
        email: 'fluritheme@gmail.com',
        homeLocation: { '@type': 'Country', name: 'Slovakia' },
      },
      {
        '@type': 'Organization',
        '@id': 'https://fluri.xyz/#organization',
        name: 'Fluri Themes',
        url: 'https://fluri.xyz/',
        logo: 'https://fluri.xyz/brand-mark-384.png',
        founder: { '@id': 'https://fluri.xyz/#founder' },
        sameAs: ['https://github.com/fluritheme'],
      },
      {
        '@type': 'SoftwareSourceCode',
        '@id': `${origin}/#software`,
        name: 'Winter by Fluri',
        url: `${origin}/`,
        description:
          'Framework independent TypeScript snow animation library with DOM-aware snow accumulation, pointer interactions, snowballs, an optional animated yeti, adaptive Canvas 2D rendering, and optional Christmas effects.',
        codeRepository: 'https://github.com/fluritheme/fluri',
        programmingLanguage: 'TypeScript',
        runtimePlatform: 'Web browser supporting Canvas 2D and ES2022',
        version,
        license: 'https://fluri.xyz/license/',
        author: { '@id': 'https://fluri.xyz/#founder' },
        keywords: [
          'JavaScript snow animation',
          'TypeScript snowfall',
          'DOM snow accumulation',
          'React snow effects',
          'Christmas website effects',
          'interactive snow physics',
        ],
      },
      {
        '@type': path === 'docs/' ? 'TechArticle' : 'WebPage',
        '@id': `${page}#page`,
        url: page,
        name: title,
        description,
        inLanguage: 'en',
        isPartOf: { '@id': `${origin}/#website` },
        about: { '@id': `${origin}/#software` },
      },
      ...(path
        ? [
            {
              '@type': 'BreadcrumbList',
              itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'Fluri', item: `${origin}/` },
                {
                  '@type': 'ListItem',
                  position: 2,
                  name: title.split('—')[0]?.trim() ?? title,
                  item: page,
                },
              ],
            },
          ]
        : []),
    ],
  };
  return `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;
}
