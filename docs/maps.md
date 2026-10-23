# Address search and routing

The local map uses Leaflet and OpenStreetMap tiles. Delivery eligibility is always computed by PostGIS, independently of the map or geocoder.

Area search is submitted explicitly by the customer. It is not autocomplete. The server restricts results to Ghana, caches searches for 24 hours, identifies the application, and shares an application-wide request gate across API instances. Users can always place a pin if search is unavailable.

Public Nominatim is restricted to development/demo volumes. Its [usage policy](https://operations.osmfoundation.org/policies/nominatim/) requires no more than one request per second for the whole application, identifying headers, attribution and caching; it prohibits autocomplete and submission of personal/confidential information. The UI asks for public areas or landmarks, separately from recipient details.

Set NOMINATIM_URL to a self-hosted or contracted compatible endpoint for production, or select MAPS_PROVIDER=google with restricted Google credentials. A commercial service must not depend on the public community endpoint at production volume.

The OSM/Google adapters and common routing interfaces are implemented. Google remains UNVERIFIED until merchant-side credentials, billing restrictions and sandbox behavior are checked. Default routing uses haversine distance with a 1.4 road factor and 20 km/h estimate; PostGIS branch selection currently orders by straight-line distance.

Sources: [Nominatim search](https://nominatim.org/release-docs/latest/api/Search/), [Google geocoding](https://developers.google.com/maps/documentation/geocoding/requests-geocoding), [Google Routes](https://developers.google.com/maps/documentation/routes/compute_route_directions).
