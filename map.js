
import mapboxgl from 'https://cdn.jsdelivr.net/npm/mapbox-gl@2.15.0/+esm';

mapboxgl.accessToken = 'pk.eyJ1IjoiYW5oYmFuZzc1OTMiLCJhIjoiY213ZnRwMDF4MDRscTJ6cGx0bXJ2bm1ndiJ9.85sJ23wvmtzR9e_dytBkDA';

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/streets-v12',
  center: [-71.09415, 42.36027],
  zoom: 12,
  minZoom: 5,
  maxZoom: 18,
});
