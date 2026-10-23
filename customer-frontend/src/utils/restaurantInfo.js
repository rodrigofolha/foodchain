// The establishment of the basket, kept in localStorage['restaurantInfo'].

// Reads it. A record kept by an older version of the page may hold the
// establishment's wallet (digital_address), which the listing no longer returns:
// it is removed from the record and from the store. Returns null when there is
// no usable record.
export function loadRestaurantInfo() {
  let info;
  try {
    info = JSON.parse(localStorage.getItem('restaurantInfo'));
  } catch (_) {
    return null;
  }
  if (!info || typeof info !== 'object' || Array.isArray(info)) return null;
  if ('digital_address' in info) {
    delete info.digital_address;
    try {
      localStorage.setItem('restaurantInfo', JSON.stringify(info));
    } catch (_) {
      // the store could not be written: the caller still gets the record without the wallet
    }
  }
  return info;
}
