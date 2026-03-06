export function distanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (v) => (v * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function getBrowserLocation(options = {}) {
  const opts = {
    enableHighAccuracy: true,
    timeout: 30000,
    maximumAge: 5000,
    ...options,
  };

  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported on this browser."));
      return;
    }

    const onError = (err) => {
      switch (err.code) {
        case err.PERMISSION_DENIED:
          reject(new Error("Location permission denied. Please allow location access in your browser settings."));
          break;
        case err.POSITION_UNAVAILABLE:
          reject(new Error("Location unavailable. Turn on Location Services/GPS and try again."));
          break;
        case err.TIMEOUT:
          reject(new Error("Timeout expired. Could not get location. Try again, or use a mobile device for better GPS."));
          break;
        default:
          reject(new Error(err.message || "Failed to get location."));
      }
    };

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        navigator.geolocation.clearWatch(watchId);
        resolve(pos);
      },
      (err) => {
        navigator.geolocation.clearWatch(watchId);
        onError(err);
      },
      opts
    );

    // Hard fallback to avoid a stuck watch forever
    setTimeout(() => {
      navigator.geolocation.clearWatch(watchId);
      reject(new Error("Timeout expired. Could not get location."));
    }, opts.timeout + 1000);
  });
}

