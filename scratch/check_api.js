async function check() {
  try {
    const res = await fetch('http://localhost:3001/api/stalls/oodles-of-noodles/menu');
    const json = await res.json();
    console.log('API RESPONSE:', json);
  } catch (err) {
    console.error('ERROR:', err);
  }
}

check();
