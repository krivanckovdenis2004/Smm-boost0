export default async function handler(req, res) {
  try {
    const response = await fetch(
      "https://justanotherpanel.com/api/v2",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
          key: process.env.JAP_API_KEY,
          action: "services"
        })
      }
    );

    const data = await response.json();

    return res.status(200).json(
      data.slice(0, 200).map(item => ({
        service: item.service,
        name: item.name,
        category: item.category,
        rate: item.rate,
        min: item.min,
        max: item.max
      }))
    );
  } catch (e) {
    return res.status(500).json({
      error: e.message
    });
  }
}
