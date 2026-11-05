/* global module */
(function (root) {
  'use strict';
  var Q = (root.Quest = root.Quest || {});
  function toRad(d) { return (d * Math.PI) / 180; }
  // Haversine distance in meters.
  function distance(lat1, lng1, lat2, lng2) {
    var R = 6371000;
    var dLat = toRad(lat2 - lat1);
    var dLng = toRad(lng2 - lng1);
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  Q.geo = { distance: distance };
  if (typeof module !== 'undefined' && module.exports) module.exports = Q;
})(typeof window !== 'undefined' ? window : globalThis);
