// server/agents/farmer.js
export async function publishListing({ farmer, product, price }) {
  // mock: in real use, write to DB/Object Storage
  return {
    ok: true,
    message: `Listing published for ${farmer}: ${product} @ ${price}`
  };
}

export async function enrichListing({ product, location }) {
  // mock enrichment
  return {
    product,
    location,
    tags: ["fresh", "local"],
    quality: "A"
  };
}

