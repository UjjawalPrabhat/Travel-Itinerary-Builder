/* script.js */

// --- Utility Functions ---
function debounce(func, wait) {
    let timeout;
    return function(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  }
  
  // --- API Keys (for demo only; secure these in production) ---
  const OPENWEATHER_API_KEY = 'c46826068f22d565e5842c4e07e71af6';
  const TRAVELPAYOUTS_TOKEN = '8ee561e97770a62fbe5425358bdd921a';
  const TRAVELPAYOUTS_MARKER = '605002';
  const GOOGLE_MAPS_API_KEY = 'AIzaSyAh4BHIMrHAu2C4375UJRN-zHa0r2pm54E';
  
  // --- Global State Variables ---
  let map;
  let itineraryItems = [];
  let weather = null;
  let directionsService, directionsRenderer, placesService;
  
  // --- Expose initMap to global scope ---
  window.initMap = function() {
    const mapOptions = {
      zoom: 13,
      center: { lat: -34.397, lng: 150.644 }
    };
    // Initialize map in the "mapPreview" element.
    map = new google.maps.Map(document.getElementById('mapPreview'), mapOptions);
    
    // Initialize Directions Service & Renderer for route planning.
    directionsService = new google.maps.DirectionsService();
    directionsRenderer = new google.maps.DirectionsRenderer({ map: map, suppressMarkers: false });
    
    // Initialize PlacesService for attractions search.
    placesService = new google.maps.places.PlacesService(map);
  };
  
  // ------------------------------
  // Module 1: Google Maps, Weather & Attractions
  // ------------------------------
  async function handleDestinationChange(e) {
    const dest = e.target.value;
    if (dest) {
      weather = await fetchWeather(dest);
      updateWeatherUI();
      geocodeAddress(dest);
      const cityCode = getIATACode(dest);
      if (cityCode) {
        searchHotels(cityCode);
      }
      searchAttractions(dest);
    } else {
      document.getElementById('weatherInfo').classList.add('hidden');
    }
  }
  
  async function fetchWeather(city) {
    try {
      const response = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&units=metric&appid=${OPENWEATHER_API_KEY}`
      );
      const data = await response.json();
      if (data.cod !== 200) {
        console.error('Weather API error:', data);
        return null;
      }
      return {
        temp: Math.round(data.main.temp),
        condition: data.weather[0].main,
        icon: data.weather[0].icon
      };
    } catch (error) {
      console.error('Error fetching weather:', error);
      return null;
    }
  }
  
  function updateWeatherUI() {
    if (weather) {
      document.getElementById('weatherInfo').classList.remove('hidden');
      document.getElementById('weatherText').innerHTML = `
        <div class="flex items-center gap-2">
          <img src="http://openweathermap.org/img/w/${weather.icon}.png" alt="Weather icon" />
          <span>${weather.temp}°C - ${weather.condition}</span>
        </div>
      `;
    }
  }
  
  async function geocodeAddress(address) {
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_MAPS_API_KEY}`
      );
      const data = await response.json();
      if (data.results && data.results[0]) {
        const location = data.results[0].geometry.location;
        map.setCenter(location);
        new google.maps.Marker({
          map: map,
          position: location
        });
      } else {
        console.error('No geocoding results found for', address);
      }
    } catch (error) {
      console.error('Error geocoding address:', error);
    }
  }
  
  // Simple mapping function for IATA codes.
  function getIATACode(city) {
    const mapping = {
      'Patna': 'PAT',
      'London': 'LON',
      'New York': 'NYC',
      'Delhi': 'DEL'
    };
    for (const key in mapping) {
      if (city.toLowerCase().includes(key.toLowerCase())) {
        return mapping[key];
      }
    }
    return city.slice(0, 3).toUpperCase();
  }
  
  function searchAttractions(query) {
    const request = {
      query: query + " tourist attraction",
      fields: ['name', 'geometry'],
      locationBias: map.getCenter()
    };
    placesService.findPlaceFromQuery(request, function(results, status) {
      const attractionsList = document.getElementById('attractionsList');
      attractionsList.innerHTML = "";
      if (status === google.maps.places.PlacesServiceStatus.OK && results) {
        results.forEach(place => {
          const div = document.createElement('div');
          div.className = 'p-2 border rounded hover:bg-gray-50 cursor-pointer';
          div.textContent = place.name;
          div.addEventListener('click', () => {
            map.setCenter(place.geometry.location);
            new google.maps.Marker({
              map: map,
              position: place.geometry.location,
              title: place.name
            });
            handleAddItem('activity', {
              title: place.name,
              details: 'Attraction',
              time: ''
            });
          });
          attractionsList.appendChild(div);
        });
        console.log('Attractions found:', results);
      } else {
        const noResult = document.createElement('div');
        noResult.className = 'p-2 border rounded';
        noResult.textContent = 'No attractions found.';
        attractionsList.appendChild(noResult);
        console.log('Attractions search returned status:', status);
      }
    });
  }
  
  // Attach refresh attractions listener.
  document.getElementById('refreshAttractionsBtn')?.addEventListener('click', () => {
    const dest = document.getElementById('destination').value;
    if (dest) {
      searchAttractions(dest);
    }
  });
  
  // ------------------------------
  // Module 2: Travelpayouts API Integration (Flights & Hotels)
  // ------------------------------
  async function searchFlights() {
    const origin = 'LON'; // Fixed origin for demo.
    const destInput = document.getElementById('destination').value.trim();
    const destination = getIATACode(destInput);
    const departureDate = document.getElementById('startDate').value; // Expecting format YYYY-MM-DD
    const returnDate = document.getElementById('endDate').value;      // Expecting format YYYY-MM-DD
    if (!destInput || !departureDate || !returnDate) return;
    try {
      // Travelpayouts flight search endpoint uses "depart_date" and "return_date"
      const flightUrl = `https://api.travelpayouts.com/v2/prices/latest?origin=${origin}&destination=${destination}&depart_date=${departureDate}&return_date=${returnDate}&token=${TRAVELPAYOUTS_TOKEN}&marker=${TRAVELPAYOUTS_MARKER}`;
      // For testing: Use a temporary CORS proxy.
      const proxyUrl = 'https://cors-anywhere.herokuapp.com/';
      const response = await fetch(proxyUrl + flightUrl);
      const data = await response.json();
      console.log('Flight Offers:', data);
      displayFlightOptions(data.data);
    } catch (error) {
      console.error('Error searching flights:', error);
    }
  }
  
  async function searchHotels() {
    const destInput = document.getElementById('destination').value.trim();
    const destination = getIATACode(destInput);
    const checkIn = document.getElementById('startDate').value;
    const checkOut = document.getElementById('endDate').value;
    if (!destInput || !checkIn || !checkOut) return;
    try {
      // Travelpayouts hotel search endpoint example.
      const hotelUrl = `https://api.travelpayouts.com/v2/prices/hotels?city=${destination}&check_in=${checkIn}&check_out=${checkOut}&token=${TRAVELPAYOUTS_TOKEN}&marker=${TRAVELPAYOUTS_MARKER}`;
      const proxyUrl = 'https://cors-anywhere.herokuapp.com/';
      const response = await fetch(proxyUrl + hotelUrl);
      const data = await response.json();
      console.log('Hotel Offers:', data);
      displayHotelOptions(data.data);
    } catch (error) {
      console.error('Error searching hotels:', error);
    }
  }
  
  function displayFlightOptions(flights) {
    const flightsList = document.createElement('div');
    flightsList.className = 'mt-4 space-y-2';
    if (!flights || flights.length === 0) {
      const noFlight = document.createElement('div');
      noFlight.className = 'p-2 border rounded';
      noFlight.textContent = 'No flight offers found.';
      flightsList.appendChild(noFlight);
    } else {
      flights.forEach((flight) => {
        const price = flight.price.total;
        const carrier = flight.itineraries[0].segments[0].carrier;
        const flightOption = document.createElement('div');
        flightOption.className = 'p-2 border rounded hover:bg-gray-50 cursor-pointer';
        flightOption.innerHTML = `<div class="flex justify-between items-center">
          <span>${carrier}</span>
          <span class="font-semibold">$${price}</span>
        </div>`;
        flightOption.addEventListener('click', () => {
          handleAddItem('flight', {
            title: `Flight ${carrier}`,
            details: `Price: $${price}`,
            time: flight.itineraries[0].segments[0].departure_at
          });
        });
        flightsList.appendChild(flightOption);
      });
    }
    const flightsContainer = document.getElementById('flightsList');
    flightsContainer.replaceChildren(flightsList);
  }
  
  function displayHotelOptions(hotels) {
    const hotelsList = document.createElement('div');
    hotelsList.className = 'mt-4 space-y-2';
    if (!hotels || hotels.length === 0) {
      const noHotel = document.createElement('div');
      noHotel.className = 'p-2 border rounded';
      noHotel.textContent = 'No hotels found.';
      hotelsList.appendChild(noHotel);
    } else {
      hotels.forEach(hotel => {
        const name = hotel.hotel.name;
        const price = hotel.offers[0].price.total;
        const hotelOption = document.createElement('div');
        hotelOption.className = 'p-2 border rounded hover:bg-gray-50 cursor-pointer';
        hotelOption.innerHTML = `<div class="flex justify-between items-center">
          <span>${name}</span>
          <span class="font-semibold">$${price}/night</span>
        </div>`;
        hotelOption.addEventListener('click', () => {
          handleAddItem('hotel', {
            title: name,
            details: `Price: $${price}/night`,
            time: '14:00'
          });
        });
        hotelsList.appendChild(hotelOption);
      });
    }
    const hotelsContainer = document.getElementById('hotelsList');
    hotelsContainer.replaceChildren(hotelsList);
  }
  
  // ------------------------------
  // Module 3: Itinerary Builder, Drag-Drop & Route Planning
  // ------------------------------
  function handleAddItem(type, data = {}) {
    const newItem = {
      id: Date.now(),
      type,
      title: data.title || `New ${type}`,
      time: data.time || '12:00',
      details: data.details || ''
    };
    itineraryItems.push(newItem);
    updateItineraryUI();
  }
  
  function createItineraryItemElement(item) {
    const div = document.createElement('div');
    div.className = 'p-4 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors cursor-move relative group';
    div.draggable = true;
    div.dataset.id = item.id;
    div.addEventListener('dragstart', handleDragStart);
    div.addEventListener('dragend', handleDragEnd);
    div.addEventListener('dragover', handleDragOver);
    div.addEventListener('drop', handleDrop);
    div.addEventListener('dragenter', handleDragEnter);
    div.addEventListener('dragleave', handleDragLeave);
    div.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" class="absolute right-2 top-2 h-5 w-5 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path d="M8 6h13"/>
        <path d="M8 12h13"/>
        <path d="M8 18h13"/>
        <path d="M3 6h.01"/>
        <path d="M3 12h.01"/>
        <path d="M3 18h.01"/>
      </svg>
      <div class="flex items-start gap-4">
        <div class="flex-1">
          <input type="text" value="${item.title}" class="w-full font-medium border-none p-0 focus:ring-0" onchange="updateItemTitle(${item.id}, this.value)" />
          <div class="mt-2 flex items-center gap-4">
            <input type="time" value="${item.time}" class="border-gray-200 rounded-md text-sm" onchange="updateItemTime(${item.id}, this.value)" />
            <textarea placeholder="Add details..." class="flex-1 text-sm border-gray-200 rounded-md" rows="1" onchange="updateItemDetails(${item.id}, this.value)">${item.details}</textarea>
          </div>
        </div>
        <button onclick="deleteItem(${item.id})" class="text-red-500 hover:text-red-600 p-1">×</button>
      </div>
    `;
    return div;
  }
  
  function updateItineraryUI() {
    const emptyState = document.getElementById('emptyState');
    if (emptyState) {
      if (itineraryItems.length === 0) {
        emptyState.classList.remove('hidden');
      } else {
        emptyState.classList.add('hidden');
      }
    }
    const itineraryList = document.getElementById('itineraryList');
    itineraryList.replaceChildren(...itineraryItems.map(createItineraryItemElement));
  }
  
  // Drag & Drop Handlers
  let draggedItem = null;
  function handleDragStart(e) {
    draggedItem = this;
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', this.dataset.id);
  }
  function handleDragEnd(e) {
    this.classList.remove('dragging');
    draggedItem = null;
    document.querySelectorAll('.drag-over').forEach(item => item.classList.remove('drag-over'));
  }
  function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }
  function handleDragEnter(e) {
    e.preventDefault();
    if (this !== draggedItem) {
      this.classList.add('drag-over');
    }
  }
  function handleDragLeave(e) {
    this.classList.remove('drag-over');
  }
  function handleDrop(e) {
    e.preventDefault();
    this.classList.remove('drag-over');
    if (this === draggedItem) return;
    const draggedId = parseInt(e.dataTransfer.getData('text/plain'));
    const targetId = parseInt(this.dataset.id);
    const draggedIndex = itineraryItems.findIndex(item => item.id === draggedId);
    const targetIndex = itineraryItems.findIndex(item => item.id === targetId);
    const [draggedObj] = itineraryItems.splice(draggedIndex, 1);
    itineraryItems.splice(targetIndex, 0, draggedObj);
    updateItineraryUI();
  }
  
  function updateItemTitle(id, value) {
    const item = itineraryItems.find(item => item.id === id);
    if (item) item.title = value;
  }
  function updateItemTime(id, value) {
    const item = itineraryItems.find(item => item.id === id);
    if (item) item.time = value;
  }
  function updateItemDetails(id, value) {
    const item = itineraryItems.find(item => item.id === id);
    if (item) item.details = value;
  }
  function deleteItem(id) {
    itineraryItems = itineraryItems.filter(item => item.id !== id);
    updateItineraryUI();
  }
  
  // Route Planning using DirectionsService.
  function planRoute() {
    if (itineraryItems.length < 2) {
      document.getElementById('routeInfo').textContent = 'Add at least two itinerary items to plan a route.';
      return;
    }
    const waypoints = itineraryItems.slice(1, itineraryItems.length - 1).map(item => ({
      location: item.title,
      stopover: true
    }));
    const origin = itineraryItems[0].title;
    const destination = itineraryItems[itineraryItems.length - 1].title;
    directionsService.route(
      {
        origin,
        destination,
        waypoints,
        travelMode: google.maps.TravelMode.DRIVING
      },
      (result, status) => {
        if (status === google.maps.DirectionsStatus.OK) {
          directionsRenderer.setDirections(result);
          let totalDistance = 0;
          let totalDuration = 0;
          const route = result.routes[0];
          route.legs.forEach(leg => {
            totalDistance += leg.distance.value;
            totalDuration += leg.duration.value;
          });
          document.getElementById('routeInfo').innerHTML = `
            <p class="font-medium">Total Distance: ${(totalDistance / 1000).toFixed(2)} km</p>
            <p class="font-medium">Total Duration: ${(totalDuration / 60).toFixed(0)} mins</p>
          `;
        } else {
          document.getElementById('routeInfo').textContent = 'Could not plan route: ' + status;
        }
      }
    );
  }
  
  // Save Itinerary to localStorage.
  function saveItinerary() {
    const destination = document.getElementById('destination').value;
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    const itineraryData = {
      destination,
      dates: { start: startDate, end: endDate },
      weather,
      items: itineraryItems
    };
    localStorage.setItem('itinerary', JSON.stringify(itineraryData));
    alert('Itinerary saved successfully!');
  }
  
  // Attach event listeners after DOM loads.
  document.addEventListener('DOMContentLoaded', () => {
    const destinationInput = document.getElementById('destination');
    destinationInput.addEventListener('input', debounce(handleDestinationChange, 500));
    document.getElementById('saveBtn').addEventListener('click', saveItinerary);
    document.getElementById("searchFlightsBtn").addEventListener("click", searchFlights);
    document.getElementById("searchHotelsBtn").addEventListener("click", searchHotels);
    document.getElementById("planRouteBtn").addEventListener("click", planRoute);
    
    // Load saved itinerary if available.
    const saved = localStorage.getItem('itinerary');
    if (saved) {
      const data = JSON.parse(saved);
      destinationInput.value = data.destination;
      document.getElementById('startDate').value = data.dates.start;
      document.getElementById('endDate').value = data.dates.end;
      weather = data.weather;
      itineraryItems = data.items;
      updateWeatherUI();
      updateItineraryUI();
    }
  });
  