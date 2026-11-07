import Link from 'next/link';
export default function About() {
  return (
    <main>
      <span className="eyebrow">A SERVER PAGE WITHOUT WEATHER</span>
      <h1>A quiet page.</h1>
      <p className="intro">
        There is no Fluri client component on this route. Navigating here unmounts the previous
        page's hook and releases its weather resources.
      </p>
      <section className="card">
        <h2>The lifecycle belongs to the route.</h2>
        <p>
          Server-rendered layouts can stay mounted across navigation. Keep route-specific weather in
          the page's client component when you want it to disappear as visitors leave.
        </p>
        <Link className="inline-code" id="return-weather" href="/">
          Return to the snowy page →
        </Link>
      </section>
    </main>
  );
}
