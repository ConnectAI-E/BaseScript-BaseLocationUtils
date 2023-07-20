const geo_url = "https://base-translator-api.replit.app/geo";
const regeo_url = "https://base-translator-api.replit.app/regeo";

export const geo = async (toGeoList: Array<any>) => {
  return await fetch(geo_url, {
    method: "POST",
    body: JSON.stringify({ address_list: toGeoList }),
    headers: { "Content-Type": "application/json" },
  })
    .then((res) => res.json())
    .then((json) => {
      return json;
    })
    .catch((err) => console.error("error:" + err));
};

export const regeo = async (locationList: Array<any>) => {
  return await fetch(regeo_url, {
    method: "POST",
    body: JSON.stringify({ location_list: locationList }),
    headers: { "Content-Type": "application/json" },
  })
    .then((res) => res.json())
    .then((json) => {
      return json;
    })
    .catch((err) => console.error("error:" + err));
};

export function checkEmpty(value: any): string {
  if (Array.isArray(value) && value.length === 0) {
    return "";
  } else if (typeof value === "string" && value.trim() === "") {
    return "";
  } else {
    return value;
  }
}
