/**
 * Serverless function for Vercel.
 * Proxies football-data.org matches API with Edge Caching.
 */
module.exports = async (req, res) => {
  const apiKey = process.env.FOOTBALL_API_KEY;
  if (!apiKey || apiKey.trim() === "") {
    return res.status(400).json({ error: "Football API Key is not configured on the server" });
  }
  
  try {
    const apiRes = await fetch("https://api.football-data.org/v4/competitions/WC/matches", {
      headers: { "X-Auth-Token": apiKey }
    });
    
    if (!apiRes.ok) {
      return res.status(apiRes.status).json({ 
        error: `Failed to fetch matches: ${apiRes.statusText}` 
      });
    }
    
    const data = await apiRes.json();
    
    // Cache on Vercel's Edge CDN for 60 seconds
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=30');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
