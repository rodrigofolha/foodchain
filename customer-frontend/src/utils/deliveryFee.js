/**
 * Delivery Fee Utilities
 *
 * Computes dynamic delivery fee based on Haversine distance.
 */

var EARTH_RADIUS_KM = 6371;
var BASE_FEE = 1;   // base fee in the same unit as current prices (U$)
var FEE_PER_KM = 1; // fee per kilometer

/**
 * Haversine formula — returns distance in kilometers between two coordinates.
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
  var toRad = function(deg) { return deg * Math.PI / 180; };
  var dLat = toRad(lat2 - lat1);
  var dLon = toRad(lon2 - lon1);
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
          Math.sin(dLon / 2) * Math.sin(dLon / 2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

/**
 * Linear delivery fee: baseFee + feePerKm * distance.
 * Returns fee as an integer (same unit convention as current prices).
 */
function calculateDeliveryFee(distanceKm) {
  return Math.round(BASE_FEE + FEE_PER_KM * distanceKm);
}

module.exports = {
  haversineDistance: haversineDistance,
  calculateDeliveryFee: calculateDeliveryFee
};
