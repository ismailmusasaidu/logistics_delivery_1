export type Coordinates = {
  lat: number;
  lng: number;
};

export type GeocodingResult = {
  coordinates: Coordinates;
  formattedAddress: string;
};

export async function geocodeAddress(address: string): Promise<GeocodingResult | null> {
  if (!address || address.trim().length < 3) {
    return null;
  }

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?` +
      `q=${encodeURIComponent(address)}&` +
      `format=json&` +
      `limit=1&` +
      `addressdetails=1`,
      {
        headers: {
          'User-Agent': 'DeliveryApp/1.0',
        },
      }
    );

    if (!response.ok) {
      console.error('Geocoding API error:', response.status);
      return null;
    }

    const data = await response.json();

    if (!data || data.length === 0) {
      console.log('No results found for address:', address);
      return null;
    }

    const result = data[0];

    return {
      coordinates: {
        lat: parseFloat(result.lat),
        lng: parseFloat(result.lon),
      },
      formattedAddress: result.display_name,
    };
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
}

export function calculateDistance(
  coord1: Coordinates,
  coord2: Coordinates
): number {
  const R = 6371;

  const dLat = toRadians(coord2.lat - coord1.lat);
  const dLng = toRadians(coord2.lng - coord1.lng);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(coord1.lat)) *
      Math.cos(toRadians(coord2.lat)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return Math.round(distance * 10) / 10;
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export async function calculateDistanceBetweenAddresses(
  pickupAddress: string,
  deliveryAddress: string
): Promise<{ distance: number; pickupCoords: Coordinates; deliveryCoords: Coordinates } | null> {
  const pickupResult = await geocodeAddress(pickupAddress);
  if (!pickupResult) {
    return null;
  }

  const deliveryResult = await geocodeAddress(deliveryAddress);
  if (!deliveryResult) {
    return null;
  }

  const distance = calculateDistance(
    pickupResult.coordinates,
    deliveryResult.coordinates
  );

  return {
    distance,
    pickupCoords: pickupResult.coordinates,
    deliveryCoords: deliveryResult.coordinates,
  };
}
