import axios from "axios";

async function recogniseSong(base64Audio) {
  const options = {
    method: "POST",
    url: "https://shazam.p.rapidapi.com/songs/v2/detect",
    params: {
      timezone: "Africa/Luanda",
      locale: "pt-AO",
    },
    headers: {
      "x-rapidapi-key": process.env.RAPIDAPI_KEY,
      "x-rapidapi-host": "shazam.p.rapidapi.com",
      "Content-Type": "text/plain",
    },
    data: base64Audio,
  };

  const response = await axios.request(options);
  return response.data;
}

export { recogniseSong };
