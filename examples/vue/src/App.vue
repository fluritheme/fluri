<script setup lang="ts">
import { ref, shallowRef } from 'vue';
import type { WeatherMetrics } from '@fluritheme/fluri';
import WeatherLayer from './WeatherLayer.vue';
const intensity = ref(0.5);
const mounted = ref(true);
const clicks = ref(0);
const state = ref('idle');
const particles = ref(0);
const appliedIntensity = ref(0.5);
const layer = shallowRef<InstanceType<typeof WeatherLayer>>();
function updateMetrics(metrics: WeatherMetrics) {
  state.value = metrics.state;
  particles.value = metrics.particleCount;
  appliedIntensity.value = intensity.value;
}
function toggleMount() {
  mounted.value = !mounted.value;
  if (!mounted.value) state.value = 'destroyed';
}
</script>
<template>
  <header>
    <a class="brand" href="#"><span aria-hidden="true">❄</span>fluri</a>
    <nav aria-label="Example sections">
      <a href="#live">Live example</a><a href="#lifecycle">Lifecycle</a>
    </nav>
  </header>
  <main id="live">
    <span class="eyebrow">VUE COMPOSITION API INTEGRATION</span>
    <h1>A component mounts.<br />A forecast follows.</h1>
    <p class="intro">
      The actual core library starts in onMounted, follows a reactive intensity value, and releases
      its resources in onUnmounted. Toggle the component to exercise the complete lifecycle.
    </p>
    <section class="controls" data-weather-ignore aria-label="Vue weather controls">
      <label class="control" for="intensity-weather"
        >Intensity<input
          id="intensity-weather"
          v-model.number="intensity"
          type="range"
          min="0"
          max="1"
          step=".01"
        /><output id="value-weather">{{ appliedIntensity.toFixed(2) }}</output></label
      ><button
        id="pause-weather"
        class="primary"
        :disabled="!mounted"
        @click="layer?.togglePause()"
      >
        {{ state === 'paused' ? 'Resume weather' : 'Pause weather' }}</button
      ><button id="add-snow" :disabled="!mounted" @click="layer?.addSnow()">Add snow</button
      ><button id="toggle-weather" @click="toggleMount">
        {{ mounted ? 'Unmount weather' : 'Mount weather' }}
      </button>
      <p class="status">
        Engine <output id="state-weather">{{ state }}</output> · {{ particles }} flakes
      </p>
    </section>
    <WeatherLayer v-if="mounted" ref="layer" :intensity="intensity" @metrics="updateMetrics" />
    <div class="cards">
      <article class="card" data-weather-surface>
        <span class="eyebrow">VUE-OWNED DOM</span>
        <h2>Reactive pages. Local snow.</h2>
        <p>
          The framework owns this card. Fluri reads its geometry and keeps deposits in surface-local
          coordinates without replacing its content.
        </p>
      </article>
      <article class="card" data-weather-surface>
        <span class="eyebrow">NORMAL INTERACTION</span>
        <h2>Your controls keep working.</h2>
        <p>Snow overlays observe the page without stealing normal clicks or scroll gestures.</p>
        <button id="ordinary-vue" @click="clicks++">
          Vue clicks <output id="vue-clicks" class="click-counter">{{ clicks }}</output>
        </button>
      </article>
    </div>
    <section class="guide" id="lifecycle">
      <h2>Mount, watch, unmount.</h2>
      <p>
        The weather component uses <code>onMounted()</code> to create its controller,
        <code>watch()</code> to apply intensity changes, and <code>onUnmounted()</code> to destroy
        the instance and clear its metrics timer.
      </p>
    </section>
    <p class="footnote">
      Reduced-motion preferences are respected. Every reported state comes from the actual
      controller.
    </p>
  </main>
  <footer>
    <span>@fluritheme/fluri · MIT licensed</span><span>Runnable Vue integration example</span>
  </footer>
</template>
