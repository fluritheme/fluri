<script setup lang="ts">
import { onMounted, onUnmounted, watch } from 'vue';
import { createWeather, type WeatherController, type WeatherMetrics } from '@themes/fluri';
const props = defineProps<{ intensity: number }>();
const emit = defineEmits<{ metrics: [value: WeatherMetrics] }>();
let weather: WeatherController | undefined;
let timer: ReturnType<typeof setInterval> | undefined;
function report() {
  if (weather) emit('metrics', weather.getMetrics());
}
function togglePause() {
  if (!weather) return;
  if (weather.getMetrics().state === 'paused') weather.resume();
  else weather.pause();
  report();
}
function addSnow() {
  weather?.addSnow(10);
}
watch(
  () => props.intensity,
  (value) => {
    weather?.setIntensity(value);
    report();
  },
);
onMounted(() => {
  weather = createWeather({
    preset: 'gentle-snow',
    autoStart: false,
    snow: { intensity: props.intensity },
    dom: { detection: 'explicit' },
    accessibility: { controls: false },
  });
  weather.start();
  report();
  timer = setInterval(report, 300);
});
onUnmounted(() => {
  clearInterval(timer);
  weather?.destroy();
  report();
  weather = undefined;
});
defineExpose({ togglePause, addSnow });
</script>
<template><span aria-hidden="true"></span></template>
