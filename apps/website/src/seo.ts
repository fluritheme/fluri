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
        name: 'Fluri',
        description:
          'Interactive snowfall and DOM-aware snow accumulation for JavaScript and TypeScript websites.',
        inLanguage: 'en',
      },
      {
        '@type': 'Person',
        '@id': `${origin}/about/#operator`,
        name: 'Frantisek Gejdos',
        url: `${origin}/about/`,
        email: 'fluritheme@gmail.com',
        homeLocation: { '@type': 'Country', name: 'Slovakia' },
      },
      {
        '@type': 'SoftwareSourceCode',
        '@id': `${origin}/#software`,
        name: 'Fluri',
        url: `${origin}/`,
        description:
          'Framework independent TypeScript snow animation library with DOM-aware snow accumulation, pointer interactions, snowballs, adaptive Canvas 2D rendering, and optional Christmas effects.',
        codeRepository: 'https://github.com/fluritheme/fluri',
        programmingLanguage: 'TypeScript',
        runtimePlatform: 'Web browser',
        version,
        license: 'https://opensource.org/license/mit',
        author: { '@id': `${origin}/about/#operator` },
        keywords: [
          'JavaScript snow animation',
          'TypeScript snowfall',
          'DOM snow accumulation',
          'React snow effects',
          'Christmas website effects',
          'interactive snow physics',
        ],
        softwareRequirements:
          'A browser supporting Canvas 2D and ES2022; see browser support documentation.',
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
