import assert from 'node:assert';

function parseGmapsCoordinates(input) {
  if (!input || typeof input !== 'string') return null;
  const str = input.trim();

  // 1. Cek Google Maps Embed URL/iframe: !2d<lng>!3d<lat>
  const embedMatch = str.match(/!2d(-?\d+(?:\.\d+)?)[^!]*!3d(-?\d+(?:\.\d+)?)/i);
  if (embedMatch) {
    const lng = parseFloat(embedMatch[1]);
    const lat = parseFloat(embedMatch[2]);
    if (!isNaN(lat) && !isNaN(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      return { latitude: lat, longitude: lng };
    }
  }

  // 1b. Alternatif embed: !3d<lat>!4d<lng>
  const embedAltMatch = str.match(/!3d(-?\d+(?:\.\d+)?)[^!]*!4d(-?\d+(?:\.\d+)?)/i);
  if (embedAltMatch) {
    const lat = parseFloat(embedAltMatch[1]);
    const lng = parseFloat(embedAltMatch[2]);
    if (!isNaN(lat) && !isNaN(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      return { latitude: lat, longitude: lng };
    }
  }

  // 2. Cek format URL @<lat>,<lng>
  const atMatch = str.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (atMatch) {
    const lat = parseFloat(atMatch[1]);
    const lng = parseFloat(atMatch[2]);
    if (!isNaN(lat) && !isNaN(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      return { latitude: lat, longitude: lng };
    }
  }

  // 3. Cek query parameter q=<lat>,<lng> atau query=<lat>,<lng> atau ll=<lat>,<lng>
  const queryMatch = str.match(/[?&](?:q|query|ll|center)=(-?\d+\.\d+)(?:%2C|,)(-?\d+\.\d+)/i);
  if (queryMatch) {
    const lat = parseFloat(queryMatch[1]);
    const lng = parseFloat(queryMatch[2]);
    if (!isNaN(lat) && !isNaN(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      return { latitude: lat, longitude: lng };
    }
  }

  // 4. Cek format koordinat langsung: -7.2575, 112.7521
  const directMatch = str.match(/^(-?\d{1,2}(?:\.\d+)?)[,\s]+(-?\d{1,3}(?:\.\d+)?)$/);
  if (directMatch) {
    const lat = parseFloat(directMatch[1]);
    const lng = parseFloat(directMatch[2]);
    if (!isNaN(lat) && !isNaN(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      return { latitude: lat, longitude: lng };
    }
  }

  return null;
}

// Test cases
// Case 1: Embed iframe
const iframe = '<iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3957.7018!2d112.7521345!3d-7.2575123!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zN8KwMTUnMjcuMCJTIDExMsKwNDUnMDcuNyJF!5e0!3m2!1sen!2sid!4v1" width="600" height="450"></iframe>';
const res1 = parseGmapsCoordinates(iframe);
console.log('Test 1 (Embed iframe):', res1);
assert.strictEqual(res1.latitude, -7.2575123);
assert.strictEqual(res1.longitude, 112.7521345);

// Case 2: URL with @lat,lng
const placeUrl = 'https://www.google.com/maps/place/Toko+Berkah/@-7.2575,112.7521,17z/data=!3m1!4b1';
const res2 = parseGmapsCoordinates(placeUrl);
console.log('Test 2 (Place URL @):', res2);
assert.strictEqual(res2.latitude, -7.2575);
assert.strictEqual(res2.longitude, 112.7521);

// Case 3: Query parameter q=lat,lng
const queryUrl = 'https://maps.google.com/?q=-7.257512,112.752134';
const res3 = parseGmapsCoordinates(queryUrl);
console.log('Test 3 (Query URL):', res3);
assert.strictEqual(res3.latitude, -7.257512);
assert.strictEqual(res3.longitude, 112.752134);

// Case 4: Direct coordinate
const direct = '-7.257512, 112.752134';
const res4 = parseGmapsCoordinates(direct);
console.log('Test 4 (Direct):', res4);
assert.strictEqual(res4.latitude, -7.257512);
assert.strictEqual(res4.longitude, 112.752134);

// Case 5: Exact user string from prompt
const userIframe = '<iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d15797.774405227756!2d112.58410744999999!3d-8.157981999999999!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x2dd62b3ab53d097f%3A0x5521d8fc9664b4a0!2sCatfish%20Autodetail%20salon%20mobil%20malang!5e0!3m2!1sid!2sid!4v1793356078316!5m2!1sid!2sid" width="600" height="450" style="border:0;" allowfullscreen="" loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe>';
const res5 = parseGmapsCoordinates(userIframe);
console.log('Test 5 (User Iframe):', res5);
assert.ok(res5 !== null);
assert.strictEqual(res5.latitude, -8.157981999999999);
assert.strictEqual(res5.longitude, 112.58410744999999);

console.log('✅ Semua test gmaps parser sukses!');

