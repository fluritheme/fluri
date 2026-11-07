import { presetNames } from '@fluritheme/fluri';
import WeatherControls from './WeatherControls';
export default function Home() {
  return (
    <main>
      <span className="eyebrow">NEXT.JS SERVER RENDERING + CLIENT HYDRATION</span>
      <h1>Winter, after hydration.</h1>
      <p className="intro">
        This heading and the cards are rendered on the server. Fluri starts in a client component
        after hydration, preserving the server-rendered content and normal React input.
      </p>
      <WeatherControls />
      <div className="cards">
        <article className="card" data-weather-surface>
          <span className="eyebrow">SERVER COMPONENT</span>
          <h2>Rendered before the first flake.</h2>
          <p>
            This card comes from the App Router server page. The engine import is safe on the
            server; its DOM work starts only in the client hook effect.
          </p>
        </article>
        <article className="card" data-weather-surface>
          <span className="eyebrow">REAL PACKAGE EXPORTS</span>
          <h2>{presetNames.length} starting forecasts.</h2>
          <p>
            The preset count above is read from the actual core export in a server component. The
            client slider updates the same engine used throughout the examples.
          </p>
        </article>
      </div>
      <section className="guide">
        <h2>Navigate away. Release the weather.</h2>
        <p>
          Use Plain page in the navigation to leave this route. The client component unmounts and
          the hook destroys its instance. Return to Snowy page to start a fresh forecast.
        </p>
      </section>
    </main>
  );
}
