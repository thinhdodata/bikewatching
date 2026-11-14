import mapboxgl from 'https://cdn.jsdelivr.net/npm/mapbox-gl@2.15.0/+esm';
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

mapboxgl.accessToken = 'pk.eyJ1IjoiYW5oYmFuZzc1OTMiLCJhIjoiY213ZnRwMDF4MDRscTJ6cGx0bXJ2bm1ndiJ9.85sJ23wvmtzR9e_dytBkDA';

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/streets-v12',
  center: [-71.09415, 42.36027],
  zoom: 12,
  minZoom: 5,
  maxZoom: 18,
});

const bikeLaneStyle = {
  'line-color': '#32D400',
  'line-width': 5,
  'line-opacity': 0.6,
};

const stationFlow = d3
  .scaleQuantize()
  .domain([0, 1])
  .range([0, 0.5, 1]);

function getCoords(station) {
  const point = new mapboxgl.LngLat(
    Number(station.lon),
    Number(station.lat)
  );

  const { x, y } = map.project(point);

  return { cx: x, cy: y };
}

function computeStationTraffic(stations, trips) {
  const departures = d3.rollup(
    trips,
    (v) => v.length,
    (d) => d.start_station_id
  );

  const arrivals = d3.rollup(
    trips,
    (v) => v.length,
    (d) => d.end_station_id
  );

  return stations.map((station) => {
    const id = station.short_name;
    const stationArrivals = arrivals.get(id) ?? 0;
    const stationDepartures = departures.get(id) ?? 0;

    return {
      ...station,
      arrivals: stationArrivals,
      departures: stationDepartures,
      totalTraffic: stationArrivals + stationDepartures,
    };
  });
}

function minutesSinceMidnight(date) {
  return date.getHours() * 60 + date.getMinutes();
}

function filterTripsbyTime(trips, timeFilter) {
  return timeFilter === -1
    ? trips
    : trips.filter((trip) => {
        const startedMinutes = minutesSinceMidnight(trip.started_at);
        const endedMinutes = minutesSinceMidnight(trip.ended_at);

        return (
          Math.abs(startedMinutes - timeFilter) <= 60 ||
          Math.abs(endedMinutes - timeFilter) <= 60
        );
      });
}

function formatTime(minutes) {
  const date = new Date(2000, 0, 1, 0, minutes);

  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getDepartureRatio(d) {
  return d.totalTraffic === 0
    ? 0.5
    : stationFlow(d.departures / d.totalTraffic);
}

map.on('load', async () => {
  map.addSource('boston_route', {
    type: 'geojson',
    data: 'https://bostonopendata-boston.opendata.arcgis.com/datasets/boston::existing-bike-network-2022.geojson',
  });

  map.addLayer({
    id: 'boston-bike-lanes',
    type: 'line',
    source: 'boston_route',
    paint: bikeLaneStyle,
  });

  map.addSource('cambridge_route', {
    type: 'geojson',
    data: 'https://raw.githubusercontent.com/cambridgegis/cambridgegis_data/main/Recreation/Bike_Facilities/RECREATION_BikeFacilities.geojson',
  });

  map.addLayer({
    id: 'cambridge-bike-lanes',
    type: 'line',
    source: 'cambridge_route',
    paint: bikeLaneStyle,
  });

  const svg = d3.select('#map').select('svg');

  const timeSlider = document.getElementById('time-slider');
  const selectedTime = document.getElementById('selected-time');
  const anyTimeLabel = document.getElementById('any-time');

  if (!timeSlider || !selectedTime || !anyTimeLabel) {
    console.error('Time filter elements not found.');
    return;
  }

  try {
    const jsonData = await d3.json(
      'https://dsc106.com/labs/lab07/data/bluebikes-stations.json'
    );

    const stations = jsonData.data.stations;

    const trips = await d3.csv(
      'https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv',
      (trip) => ({
        ...trip,
        started_at: new Date(trip.started_at),
        ended_at: new Date(trip.ended_at),
      })
    );

    const allStations = computeStationTraffic(stations, trips);

    const radiusScale = d3
      .scaleSqrt()
      .domain([
        0,
        d3.max(allStations, (d) => d.totalTraffic) || 1,
      ])
      .range([0, 25]);

    let circles = svg
      .selectAll('circle')
      .data(allStations, (d) => d.short_name)
      .join('circle')
      .attr('fill', 'steelblue')
      .attr('stroke', 'white')
      .attr('stroke-width', 1)
      .attr('fill-opacity', 0.6)
      .style('--departure-ratio', getDepartureRatio);

    function updatePositions() {
      circles
        .attr('cx', (d) => getCoords(d).cx)
        .attr('cy', (d) => getCoords(d).cy);
    }

    function updateScatterPlot(timeFilter) {
      const filteredTrips = filterTripsbyTime(trips, timeFilter);

      const filteredStations = computeStationTraffic(
        stations,
        filteredTrips
      );

      if (timeFilter === -1) {
        radiusScale.range([0, 25]);
      } else {
        radiusScale.range([3, 50]);
      }

      circles = svg
        .selectAll('circle')
        .data(filteredStations, (d) => d.short_name)
        .join('circle')
        .attr('r', (d) => radiusScale(d.totalTraffic))
        .attr('stroke', 'white')
        .attr('stroke-width', 1)
        .attr('fill-opacity', 0.6)
        .style('--departure-ratio', getDepartureRatio);

      circles
        .selectAll('title')
        .data((d) => [d])
        .join('title')
        .text(
          (d) =>
            `${d.totalTraffic} trips (${d.departures} departures, ${d.arrivals} arrivals)`
        );

      updatePositions();
    }

    function updateTimeDisplay() {
      const timeFilter = Number(timeSlider.value);

      if (timeFilter === -1) {
        selectedTime.textContent = '';
        anyTimeLabel.style.display = 'block';
      } else {
        selectedTime.textContent = formatTime(timeFilter);
        anyTimeLabel.style.display = 'none';
      }

      updateScatterPlot(timeFilter);
    }

    timeSlider.addEventListener('input', updateTimeDisplay);

    map.on('move', updatePositions);
    map.on('zoom', updatePositions);
    map.on('resize', updatePositions);

    updateTimeDisplay();

  } catch (error) {
    console.error('Error loading bike traffic data:', error);
  }
});
